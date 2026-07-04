export function buildDocumentChatSystemPrompt(agentSystemPrompt?: string) {
  const customInstructions = agentSystemPrompt?.trim();
  return [
    "You answer questions using only the supplied document context. If the answer is not in the context, say what is missing. Keep answers in English and cite chunk numbers when useful.",
    customInstructions
      ? `User-configured agent instructions: ${customInstructions}`
      : null,
    "The document-grounding rules take priority if any agent instruction conflicts with them.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
