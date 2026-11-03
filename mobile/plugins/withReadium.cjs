const { withPodfile, withAppBuildGradle } = require('expo/config-plugins');
function patchPodfile(s) {
  if (s.includes('# ysh-readium')) return s;
  if (!/target .+ do/.test(s) || !s.includes('post_install do |installer|'))
    throw new Error('Readium: unexpected Podfile template');
  return `# ysh-readium\nsource 'https://github.com/readium/podspecs'\nsource 'https://cdn.cocoapods.org/'\nrequire_relative '../node_modules/react-native-readium/scripts/readium_pods'\nrequire_relative '../node_modules/react-native-readium/scripts/readium_post_install'\n${s}`
    .replace(/(target .+ do)/, '$1\n  readium_pods')
    .replace(
      'post_install do |installer|',
      'post_install do |installer|\n    readium_post_install(installer)'
    );
}
function patchGradle(s) {
  if (s.includes('// ysh-readium')) return s;
  if (!/android\s*\{/.test(s) || !/dependencies\s*\{/.test(s))
    throw new Error('Readium: unexpected Gradle template');
  if (!s.includes('compileOptions {'))
    s = s.replace(
      /android\s*\{/,
      'android {\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }'
    );
  return (
    '// ysh-readium\n' +
    s
      .replace('compileOptions {', 'compileOptions {\n        coreLibraryDesugaringEnabled true')
      .replace(
        /dependencies\s*\{/,
        'dependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")'
      )
  );
}
module.exports = function withReadium(config) {
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = patchPodfile(mod.modResults.contents);
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = patchGradle(mod.modResults.contents);
    return mod;
  });
};
module.exports.patchPodfile = patchPodfile;
module.exports.patchGradle = patchGradle;
