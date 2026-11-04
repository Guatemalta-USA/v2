import { onAuthStateChanged } from "firebase/auth";
import { router } from "./router";
import { renderHomepage } from "./views/homepage.view.js";
import { auth } from "./services/firebase";
import { state } from "./modules/state.module";
import { getUserRole, signInWithGooglePopup } from "./services/auth.service.ts.js";
import { createMessage } from "./modules/utils";
import { renderDynamicPage } from "./views/dynamicPage.view";
import { renderNotFound } from "./views/notFound.view";
import { loadFooter, loadHeader, loadNav } from "./modules/templates.js";
import { renderAboutPage } from "./views/about.view.js";
import { initGivebutter } from "./services/givebutter.service.js";
import { renderMailingList } from "./views/mailingList.view.js";
import { renderAdminPage } from "./views/admin.view.js";
import { renderBlogPost } from "./views/blogPost.view.js";
import { renderDonatePage } from "./views/donate.view.js";
import { renderImpactPage } from "./views/impact.view.js";
import { renderBlogPage } from "./views/blog.view.js";
import './css/style.css';
import './css/grid.css';
import './css/form.css';
import './css/quill.css';
import { renderProjectPage } from "./views/project.view.js";

const mainElement = document.querySelector("main") as HTMLElement;

// Initialize global services and layout templates once on load
initGivebutter();
loadHeader();
loadNav();
loadFooter();

async function initApp() {

  router.addRoute("/", () => {
    state.setPageContext({ parent: "home" });
    renderHomepage(mainElement);
  });

  router.addRoute("/index", () => {
    state.setPageContext({ parent: "home" });
    renderHomepage(mainElement);
  });

  router.addRoute("/about", () => {
    state.setPageContext({ parent: "about", page: "About Us" });
    renderAboutPage(mainElement);
  });

  router.addRoute("/admin", () => {
    state.setPageContext({parent: "admin", page: "Admin"});
    renderAdminPage(mainElement);
  });

  router.addRoute("/blog", () => {
    state.setPageContext({ parent: "blog", page: "Blog" });
    renderBlogPage(mainElement);
  });

  router.addRoute("/blog/:id", (params) => {
    state.setPageContext({ parent: "blog", page: params.id });
    const postId = params.id;
    renderBlogPost(mainElement, postId);
  });

  router.addRoute("/blog/:id/edit", (params) => {
    state.setPageContext({ parent: "blog", page: `Edit ${params.id}` });
    const postId = params.id;
    console.log(`will send to ${postId} edit`);
  });

  router.addRoute("/donate", () => {
    state.setPageContext({ parent: "donate", page: "Donate" });
    renderDonatePage(mainElement);
  });

  router.addRoute("/donate/:id", (params) => {
    state.setPageContext({ parent: "donate", page: "Donate" });
    const formId = params.id;
    renderDonatePage(mainElement, formId);
  });

  router.addRoute("/impact", () => {
    state.setPageContext({ parent: "impact", page: "Impact" });
    renderImpactPage(mainElement);
  });

  router.addRoute("/impact/:id", (params) => {
    state.setPageContext({ parent: "impact", page: params.id });
    const projectId = params.id;
    renderProjectPage(mainElement, projectId);
  });

  router.addRoute("/impact/:id/edit", (params) => {
    state.setPageContext({ parent: "impact", page: `Edit ${params.id}` });
    const projectId = params.id;
    console.log(`will send to ${projectId} edit`);
  });

  router.addRoute("/login", async () => {
    createMessage({ messageBody: "Opening Google sign-in window", location: "main-message", type: "info" });
    try {
      const result = await signInWithGooglePopup();
      //If successful sign in with Google, close the modal and display the message
      const user = result.user;
      if (user) {
        //Close the sign in modal
        createMessage({ messageBody: `Welcome ${user.displayName}`, location: "main-message", type: "check_circle", autoCloseSeconds: 5 });
      }
    } catch (error: any) {
      let errorMessage = "Google sign-in failed"
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-In window closed";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Sign-In request already in progress";
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      createMessage({ messageBody: errorMessage, location: "main-message", type: "error" });
      console.error("Google sign-in error details:", error);
    }
  });

  router.addRoute("/mailinglist", () => {
    state.setPageContext({ parent: "mailinglist", page: "Mailing List" });
    renderMailingList(mainElement);
  });

  router.addRoute("/sponsor-a-child", () => {
    state.setPageContext({ parent: "impact", page: "Sponsor A Child" });
    // Add sponsor a child view render logic here
  });

  router.addRoute('/:id', (params) => {
    state.setPageContext({ page: params.id });
    const pageId = params.id;
    renderDynamicPage(mainElement, pageId);
  });

  router.addRoute('*', () => {
    state.setPageContext({ page: "Not Found" });
    const attemptedPath = window.location.pathname.replace(/^\/+/, '');
    renderNotFound(mainElement, attemptedPath);
  });

  onAuthStateChanged(auth, async (user) => {
    if (user?.uid !== state.currentUser?.uid) {
        state.setCurrentUser(user);
        state.setCurrentRole(null);
        try {
            if (user) {
                const role = await getUserRole(user.uid);
                state.setCurrentRole(role);
            }
        } catch (error: any) {
            createMessage({ messageBody: error.message || error, location: "main-message", type: "error" });
        }
    }
});

  router.init();
}

initApp();