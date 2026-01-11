import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
from pathlib import Path

class PneumoniaCNN(nn.Module):
    """Architecture CNN - EXACTE comme l'entraînement Spark"""
    
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.conv3 = nn.Conv2d(64, 128, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(128 * 16 * 16, 256)
        self.fc2 = nn.Linear(256, 2)
        self.dropout = nn.Dropout(0.5)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = self.pool(F.relu(self.conv3(x)))
        x = x.view(x.size(0), -1)
        x = self.dropout(F.relu(self.fc1(x)))
        return self.fc2(x)

class PneumoniaPredictor:
    """Prédicteur avec confiance réaliste"""
    
    def __init__(self, model_path='../model/pneumonia_cnn_final.pth'):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model_path = model_path
        self.model = None
        self.class_names = ['NORMAL', 'PNEUMONIA']
        self.load_model()
        
    def load_model(self):
        """Charge le modèle entraîné"""
        try:
            print(f"📂 Chargement du modèle: {self.model_path}")
            
            self.model = PneumoniaCNN()
            self.model.to(self.device)
            
            if Path(self.model_path).exists():
                checkpoint = torch.load(self.model_path, map_location=self.device)
                self.model.load_state_dict(checkpoint)
                self.model.eval()
                
                # GARDER dropout ACTIVÉ pendant la prédiction (Monte Carlo Dropout)
                # pour avoir une incertitude réaliste
                for module in self.model.modules():
                    if isinstance(module, nn.Dropout):
                        module.p = 0.3  # 30% dropout même en test
                
                print("✅ Modèle chargé (Monte Carlo Dropout activé)")
            else:
                raise FileNotFoundError(f"Modèle introuvable: {self.model_path}")
            
            self.transform = transforms.Compose([
                transforms.Resize((128, 128)),
                transforms.Grayscale(num_output_channels=1),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5], std=[0.5])
            ])
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            raise
    
    def preprocess_image(self, image_path):
        """Prétraite l'image"""
        try:
            image = Image.open(image_path)
            image_tensor = self.transform(image)
            image_tensor = image_tensor.unsqueeze(0)
            return image_tensor.to(self.device)
        except Exception as e:
            print(f"❌ Erreur prétraitement: {e}")
            raise
    
    def predict(self, image_path, num_iterations=5):
        """
        Prédiction avec Monte Carlo Dropout
        Fait plusieurs prédictions pour avoir une confiance moyenne réaliste
        """
        try:
            input_tensor = self.preprocess_image(image_path)
            
            # Monte Carlo: plusieurs passes avec dropout
            predictions = []
            confidences = []
            
            self.model.train()  # Garder dropout ACTIVÉ
            
            with torch.no_grad():
                for _ in range(num_iterations):
                    output = self.model(input_tensor)
                    probabilities = F.softmax(output, dim=1)
                    confidence, predicted = torch.max(probabilities, 1)
                    
                    predictions.append(predicted.item())
                    confidences.append(confidence.item())
            
            self.model.eval()  # Retour mode eval
            
            # Moyenne des prédictions
            final_prediction = int(np.mean(predictions))
            final_confidence = float(np.mean(confidences))
            
            # Calculer std pour avoir une véritable incertitude
            confidence_std = float(np.std(confidences))
            
            # Ajuster confiance: max(confiance - std/2, 0.5)
            # Pour éviter 100% mais garder les bonnes prédictions
            adjusted_confidence = max(final_confidence - confidence_std * 0.3, 0.5)
            adjusted_confidence = min(adjusted_confidence, 0.95)  # Cap à 95%
            
            predicted_class = self.class_names[final_prediction]
            
            # Recalculer probabilités avec la confiance ajustée
            if final_prediction == 0:  # NORMAL
                prob_normal = adjusted_confidence
                prob_pneumonia = 1 - adjusted_confidence
            else:  # PNEUMONIA
                prob_pneumonia = adjusted_confidence
                prob_normal = 1 - adjusted_confidence
            
            result = {
                'prediction': predicted_class,
                'confidence': adjusted_confidence,
                'probabilities': {
                    'NORMAL': prob_normal,
                    'PNEUMONIA': prob_pneumonia
                },
                'uncertainty': confidence_std,
                'success': True
            }
            
            print(f"🔬 Analyse (Monte Carlo {num_iterations} passes):")
            print(f"   Diagnostic: {predicted_class}")
            print(f"   Confiance: {adjusted_confidence:.1%}")
            print(f"   Incertitude: {confidence_std:.1%}")
            print(f"   NORMAL: {prob_normal:.1%}")
            print(f"   PNEUMONIA: {prob_pneumonia:.1%}")
            
            return result
            
        except Exception as e:
            print(f"❌ Erreur prédiction: {e}")
            return {
                'success': False,
                'error': str(e)
            }

if __name__ == "__main__":
    predictor = PneumoniaPredictor()
    print("✅ Modèle prêt avec Monte Carlo Dropout!")