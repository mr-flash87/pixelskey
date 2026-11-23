# PayDunya
- [x] Préparer le paiement PayDunya et désactiver LeekPay pour les nouveaux achats.
- [x] Ajouter les réglages sécurisés PayDunya dans les paramètres admin.
- [x] Vérifier le contrôle des notifications et préparer la livraison et le rattrapage des confirmations.
- [x] Déployer et tester les états sans identifiants.
- [ ] Vérifier un paiement PayDunya réel — attend les identifiants de l’utilisateur.

# Catalogue fournisseur
- [x] Traduire avec l’IA le catalogue importé : 32 offres mises à jour, prix et liens conservés, fiches françaises vérifiées sur mobile et ordinateur ; tests de protection réussis.
- [x] Corriger les stocks affichés comme épuisés malgré un réapprovisionnement ; ancien zéro remplacé par 100, ajout au panier et conservation des 99 restants après rechargement vérifiés sur mobile et ordinateur, 12 tests réussis.
- [x] Importer les 11 offres manuelles Prime Labs vérifiées ; 10 nouvelles et Gamma réactivée, mention de traitement et récapitulatif PayDunya vérifiés sur mobile et ordinateur sans achat.
- [ ] Vérifier une livraison manuelle Prime Labs réelle — achat de test à autoriser ; les services d’activation restent exclus car ils nécessitent un parcours distinct.
- [x] Afficher et vendre six offres manuelles Digitrust vérifiées, dont les deux Autodesk, avec visuels et mention de traitement fournisseur ; synchronisation réussie et parcours produit → récapitulatif PayDunya vérifié sur mobile et ordinateur sans achat.
- [ ] Confirmer une livraison manuelle Digitrust réelle — achat de test autorisé et portefeuille approvisionné nécessaires ; les réponses sans accès restent en attente, jamais livrées artificiellement.
- [x] Compléter les 17 produits visibles sans image avec neuf visuels de marque partagés ; aucun produit actif sans image, tests et pages produit mobile/ordinateur vérifiés.
- [x] Comparer les ruptures affichées avec le stock réel Digitrust : 35 offres publiées, 11 disponibles et 24 réellement épuisées ; quantités identiques au fournisseur, synchronisation du 9 novembre à 05:15 UTC réussie.
- [x] Placer les produits disponibles en premier et les ruptures sur les dernières pages ; première et dernière page mobile vérifiées.
- [x] Activer les achats Digitrust en stock indépendamment du portefeuille, informer du délai possible et vérifier Acheter → panier → bouton PayDunya sans transaction.
- [x] Rendre les offres Digitrust vérifiées visibles, même avec portefeuille vide, sans autoriser les achats indisponibles ; synchronisation et recherche publique mobile vérifiées.
- [x] Ajouter Digitrust comme second fournisseur sans supprimer Prime Labs ; connexion et import de 45 offres vérifiés dans l’admin, livraison préparée sans achat réel.
- [ ] Vérifier une livraison Digitrust réelle — portefeuille fournisseur à recharger et achat de test à autoriser.
- [x] Compléter les images des marques manquantes et partager automatiquement le visuel entre leurs offres ; quatre nouveaux visuels, huit produits complétés, tests et affichage vérifiés.
- [x] Traduire les descriptions existantes et conserver leur traduction lors des synchronisations.
- [x] Automatiser la synchronisation des services, prix et stocks Prime Labs.
- [x] Vérifier une synchronisation réelle et sa programmation.

# Affichage mobile
- [x] Empêcher les descriptions de déborder et vérifier les pages boutique et admin sur petits écrans (320 à 1280 px).

# SEO
- [x] Ajouter un titre principal visible et unique à l’accueil.
- [x] Retirer les images de partage relatives invalides et identifier les pages produit dans leurs métadonnées.
- [ ] Aperçus sociaux propres à chaque page — nécessite une migration avec rendu serveur et des images de partage appropriées.
- Guide Netflix au Sénégal : reporté à la demande de l’utilisateur.

# Dossier de présentation
- [x] Produire une version mobile exclusivement côté client : 14 captures mobile et 12 ordinateur, documents et prompt vidéo sans administration ; 33 pages PDF et archive vérifiées.
- [x] Capturer les pages publiques et le parcours jusqu’au bouton PayDunya sans effectuer d’achat, avec administration anonymisée.
- [x] Créer une présentation illustrée et un dossier explicatif avec prompt Claude 3D, référence à joindre et voix off.
- [x] Vérifier visuellement les 31 pages PDF et contrôler l’archive organisée.
- [ ] Compléter par des captures de la passerelle et de la confirmation — nécessite un test de paiement autorisé ; aucune transaction lancée pour ce dossier.

# Pied de page
- [x] Ajouter une FAQ sur la livraison, les paiements Mobile Money et le support WhatsApp, et les intitulés complets des pages légales.
- [x] Intégrer les vrais logos Orange Money, Wave, MTN MoMo et Moov Money Burkina ; fichiers hébergés accessibles, affichage vérifié, FAQ et liens légaux testés, sans débordement sur mobile.

# Migration hors plateforme
- [x] Copier le code source, retirer les dépendances à la plateforme précédente (IA, e-mails, connecteur Digitrust, stockage de session).
- [ ] Ajouter les images binaires manquantes (voir README).
- [ ] Configurer les secrets Supabase (Brevo, IA, Digitrust) et redéployer les fonctions.
- [ ] Déployer le site sur Hostinger.
