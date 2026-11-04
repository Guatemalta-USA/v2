import { makeElement } from "../modules/utils";

export async function renderBlogPost(container: HTMLElement, postId: string) {
    container.innerHTML = "";

    const tempP = makeElement("p", null, null, `This is the page for ${postId}`);
    container.appendChild(tempP);
    
}