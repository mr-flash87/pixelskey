export interface CatalogTranslation { id: string; name: string; description: string }
export function translationPatch(original: CatalogTranslation, translated: CatalogTranslation) {
  if (translated.id !== original.id || !translated.name.trim() || (original.description.trim() && !translated.description.trim())) {
    throw new Error("Traduction incomplète ou produit incorrect");
  }
  const numbers = (text: string) => [...new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? [])].sort().join("|");
  if (numbers(original.name) !== numbers(translated.name)) throw new Error("La traduction a changé les valeurs du nom");
  return { name: translated.name.trim(), description: translated.description.trim() };
}
