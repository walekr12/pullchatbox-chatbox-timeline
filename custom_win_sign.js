exports.default = async function signWindowsBuild() {
  // Intentionally unsigned. This keeps community CI builds packageable without a private code-signing certificate.
  return undefined
}
