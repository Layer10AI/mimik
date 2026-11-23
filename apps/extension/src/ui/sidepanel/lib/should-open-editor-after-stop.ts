// Interview recordings stay in the side panel: the editor is Mimik's full product
// surface (export, Guide Me, AI keys), which an interviewee must not see.
export function shouldOpenEditorAfterStop(interviewMode: boolean | undefined): boolean {
  return interviewMode !== true;
}
