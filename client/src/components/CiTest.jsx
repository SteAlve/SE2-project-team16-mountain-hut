// CI test: this file breaks the lint on purpose (components/ may not call fetch). Do not merge.
export function CiTest() {
  fetch('/api/ci-test');
  return null;
}
