export type TranslateTextOptions = {
  sourceLang?: string
}

export async function translateTexts(
  texts: string[],
  _targetLang: string,
  _options: TranslateTextOptions = {},
): Promise<string[]> {
  // Fallback implementation for builds where no translation backend is bundled.
  return texts
}
