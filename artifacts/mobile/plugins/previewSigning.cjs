/** EAS injects the Preview release credentials after prebuild. Validate at task execution. */
const PREVIEW_SIGNING_GUARD = `
// AnyChess Preview: credentials belong to com.anychess.preview only.
tasks.register('verifyPreviewReleaseSigning') {
    doLast {
        if (android.defaultConfig.applicationId != 'com.anychess.preview') {
            throw new GradleException('Preview signing guard requires com.anychess.preview')
        }
        def signing = android.buildTypes.release.signingConfig
        if (signing == null || signing.storeFile == null || !signing.storeFile.exists() ||
            !signing.storePassword || !signing.keyAlias || !signing.keyPassword ||
            signing.keyAlias == 'androiddebugkey' ||
            signing.storeFile.canonicalFile == android.signingConfigs.debug.storeFile?.canonicalFile) {
            throw new GradleException('Preview requires its own persistent release credentials from EAS')
        }
        def store = java.security.KeyStore.getInstance(signing.storeType ?: 'JKS')
        signing.storeFile.withInputStream { stream -> store.load(stream, signing.storePassword.toCharArray()) }
        def cert = store.getCertificate(signing.keyAlias)
        if (cert == null) throw new GradleException('Preview release certificate unavailable')
        def fingerprint = java.security.MessageDigest.getInstance('SHA-256').digest(cert.encoded)
            .collect { String.format('%02X', it & 0xff) }.join('')
        // Public Expo debug, Stable and historical standalone certificates are forbidden.
        if (fingerprint in [
            'FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B833266759191033B9C',
            '2970CD990A63434C2E41E298EBBC77775270A43CF7A181EB44CF5780B374D911',
            'CBDF1C90EEFAB09180BE477390F99906241AAEDE1F48962AB8E9416AFD4CE7AA'
        ]) throw new GradleException('Preview cannot use an existing variant or debug certificate')
    }
}
tasks.configureEach {
    if (name == 'validateSigningRelease' || name == 'packageRelease' || name == 'assembleRelease') {
        dependsOn('verifyPreviewReleaseSigning')
    }
}
`;

function injectPreviewSigningGuard(contents) {
  if (contents.includes("tasks.register('verifyPreviewReleaseSigning')")) return contents;
  return `${contents}\n${PREVIEW_SIGNING_GUARD}`;
}
module.exports = { injectPreviewSigningGuard };
