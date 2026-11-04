import { getPageContents } from "../services/firebase.service.ts";


export async function renderDynamicPage(mainElement: HTMLElement, pageId: string) {
mainElement.innerHTML = "";
const page = await getPageContents(pageId);
console.log(page?.pageName)
}