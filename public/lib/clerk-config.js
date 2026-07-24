// Dein Clerk-Publishable-Key (Clerk Dashboard -> API Keys -> Publishable key).
// Der Key ist ÖFFENTLICH und fürs Frontend gedacht, kein Geheimnis.
// NIEMALS den "Secret key" hier eintragen (der gehört nur auf den Server).
//
// Solange "pk_test_DEIN-KEY" drinsteht, läuft das Onboarding im Simulations-Modus
// (kein echtes Login). Sobald ein echter Key drinsteht, übernimmt Clerk das Login
// inklusive E-Mail-Bestätigung.
window.CLERK_PUBLISHABLE_KEY = "pk_test_DEIN-KEY";
