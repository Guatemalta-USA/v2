import { Timestamp } from "firebase/firestore";
import type { MessageParams } from "../models/helper.model";
import { SOCIAL_DATA } from "../models/social.model";
import type { ProjectInfo } from "../models/project.model";

type ButtonParams = {
  buttonText: string;
  buttonType: "button" | "submit" | "reset";
  buttonId: string;
  buttonClass: string;
  i18n?: string;
  icon?: string;
};

export function createButton(
  params: ButtonParams
): HTMLElement {
  const newButton = document.createElement("button");
  newButton.setAttribute("type", params["buttonType"]);
  newButton.setAttribute("id", params["buttonId"]);
  newButton.setAttribute("class", params["buttonClass"]);
  if (params["icon"]) {
    const buttonIconSpan = document.createElement("span");
    buttonIconSpan.setAttribute("class", "material-symbols-outlined");
    const buttonIcon = document.createTextNode(params["icon"]);
    buttonIconSpan.appendChild(buttonIcon);
    newButton.appendChild(buttonIconSpan);
  }
  const buttonTextElm = makeElement("span", null, null, params["buttonText"], params["i18n"]);
  newButton.appendChild(buttonTextElm);
  return newButton;
}

export function createLink(linkText: string, url: string, external: boolean) {
  const newLink = document.createElement("a")
  newLink.textContent = linkText;
  if (url != "") {
    newLink.setAttribute("href", url);
  }
  if (external) {
    newLink.setAttribute("target", "_blank");
  }
  return newLink;
}

export function createMessage(
  params: MessageParams
) {
  clearMessages();
  const messageWrapper = document.getElementById(params["location"]) as HTMLElement;
  if (!messageWrapper) return;

  const messageDiv = document.createElement("div");
  if (params["type"] === "check_circle") {
    messageDiv.setAttribute("class", "success message");
    messageDiv.setAttribute("aria-live", "polite");
  } else if (params["type"] === "error") {
    messageDiv.setAttribute("class", "error message");
    messageDiv.setAttribute("role", "alert");
    console.error(params["messageBody"]);
  } else if (params["type"] === "delete" || params["type"] === "warn") {
    messageDiv.setAttribute("class", "warn message");
    messageDiv.setAttribute("aria-live", "polite");
    console.warn(params["messageBody"]);
  } else {
    messageDiv.setAttribute("class", "info message");
    messageDiv.setAttribute("aria-live", "polite");
  }

  const icon = document.createElement("span");
  icon.setAttribute("class", "material-symbols-outlined");
  const iconName = document.createTextNode(params["type"]);
  icon.appendChild(iconName);
  messageDiv.appendChild(icon);

  const messageText = document.createTextNode(params["messageBody"]);
  messageDiv.appendChild(messageText);

  const closeButton = createButton({
    buttonText: "",
    buttonType: "button",
    buttonId: "closeButton",
    buttonClass: "",
    icon: "close"
  });
  closeButton.addEventListener("click", () => (messageWrapper.innerHTML = ""));
  messageDiv.appendChild(closeButton);

  messageWrapper.appendChild(messageDiv);

  if (params["autoCloseSeconds"] && params["autoCloseSeconds"] > 0) {
    setTimeout(() => {
      if (messageWrapper.contains(messageDiv)) {
        messageWrapper.innerHTML = "";
      }
    }, params["autoCloseSeconds"] * 1000);
  }
}

export function createTableHeader(tableHeadings: string[], textAlign: string) {
  const tableHead = tableHeadings.reduce((acc: HTMLElement, currentHeading: string) => {
    const newColumnHeader = makeElement("th", null, textAlign, null);
    const columnHeaderName = document.createTextNode(currentHeading);
    newColumnHeader.appendChild(columnHeaderName);
    acc.appendChild(newColumnHeader);
    return acc;
  }, document.createElement("thead"));
  return tableHead;
}

export function createSimpleTableRow(rowCells: string[], isHTML: boolean) {
  if (isHTML) {
    const tableRow = rowCells.reduce((acc: HTMLElement, currentCell: string) => {
      const newCell = document.createElement("td");
      newCell.innerHTML = currentCell;
      acc.appendChild(newCell);
      return acc;
    }, document.createElement("tr"));
    return tableRow;
  } else {
    const tableRow = rowCells.reduce((acc: HTMLElement, currentCell: string) => {
      const newCell = makeElement("td", null, null, currentCell);
      acc.appendChild(newCell);
      return acc;
    }, document.createElement("tr"));
    return tableRow;
  }
}

export function createSocialLink(platformKey: string, size: number = 24): HTMLAnchorElement | null {
  const data = SOCIAL_DATA[platformKey.toLowerCase()];
  if (!data) return null;

  const link = document.createElement('a');
  link.href = data.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.classList.add('social-link');

  // Custom property to tell CSS what the brand color is
  link.style.setProperty('--brand-color', data.brandColor);

  link.innerHTML = `
    <svg viewBox="${data.viewBox}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      ${data.content}
    </svg>
    <span class="social-text">${data.name}</span>
  `;

  return link;
}

export function clearMessages() {
  const messageWrappers = document.getElementsByClassName("message-wrapper");
  for (const messageWrapper of messageWrappers) {
    messageWrapper.innerHTML = "";
  }
}

export function storeMessage(params: MessageParams) {
  clearMessages();
  sessionStorage.setItem("message", JSON.stringify(params));
}

export function fixDate(
  dateString: string | Timestamp,
  dateFormat: string,
): string {
  let dateObj: Date = new Date(0);
  //If Timestamp, convert it to a date object
  if (dateString instanceof Timestamp) {
    dateObj = dateString.toDate();
  }
  //If string, create a new date object
  else if (typeof dateString === "string") {
    dateObj = new Date(dateString);
  }
  //Check if the date object is valid
  if (isNaN(dateObj.getTime())) {
    console.error(
      "fixDate received an invalid date object after parsing:",
      dateString,
    );
    return "Invalid Date";
  }
  //Add timezone to fix date off by one error (with help from stackOverflow thread: https://stackoverflow.com/questions/7556591/is-the-javascript-date-object-always-one-day-off)
  let dateTimezoneFixed: Date = new Date(
    dateObj.getTime() - dateObj.getTimezoneOffset() * -60000,
  );
  //Define formatting options
  const options: Intl.DateTimeFormatOptions =
    dateFormat === "shortDate"
      ? { month: "2-digit", day: "2-digit", year: "numeric" }
      : { month: "long", day: "2-digit", year: "numeric" };
  return dateTimezoneFixed.toLocaleDateString("en-US", options);
}

export function formatDate(rawDate: any, includeTime: boolean) {
  const lastUpdatedDate = rawDate && typeof (rawDate as any).toDate === 'function'
    ? (rawDate as any).toDate()
    : (rawDate instanceof Date ? rawDate : new Date());

  if (includeTime) {
    return lastUpdatedDate.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    return lastUpdatedDate.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: 'numeric'
    });
  }
}

export function makeElement(elementType: string, elementId: string | null, elementClass: string | null, elementText: string | null, i18n?: string) {
  const newElement = document.createElement(elementType);
  if (elementId) newElement.setAttribute('id', elementId);
  if (elementClass) {
    newElement.setAttribute('class', elementClass);
  }
  if (elementText) newElement.textContent = elementText;
  if (i18n) {
    newElement.setAttribute("data-i18n", i18n);
  }
  return newElement;
}

export function makePBLock(pParts: KeyValue[]) {
  return pParts.reduce((acc: HTMLElement, currentPart: KeyValue) => {
    const nextPart = makeElement(currentPart[0], null, null, currentPart[1]);
    acc.appendChild(nextPart);
    return acc;
  }, document.createElement("p"));
}

export async function confirmDeleteModal(messageHeader: string, messageBody: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modalRoot = makeElement("div", "modal-root", null, null);
    const modalOverlay = makeElement("div", null, "modal-overlay", null);
    const modalContent = makeElement("div", null, "modal-content", null);

    const modalH2 = makeElement("h2", null, null, messageHeader);
    modalContent.appendChild(modalH2);

    const modalMessage = makeElement("p", null, null, messageBody);
    modalContent.appendChild(modalMessage);

    const formRow = makeElement("div", null, "button-row", null);

    const closeModal = () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("noScroll");
      if (document.body.contains(modalRoot)) {
        document.body.removeChild(modalRoot);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        resolve(false);
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = modalContent.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const deleteButton = createButton({ buttonText: "Delete", buttonType: "button", buttonId: "delete-button", buttonClass: "delete-button", icon: "delete", i18n: "button_delete" });
    deleteButton.onclick = function () {
      closeModal();
      resolve(true);
    };

    const cancelButton = createButton({ buttonText: "Cancel", buttonType: "button", buttonId: "cancel-btn", buttonClass: "accent-button", icon: "close", i18n: "button_cancel" });
    cancelButton.onclick = function () {
      closeModal();
      resolve(false);
    };
    formRow.append(cancelButton, deleteButton);

    modalContent.appendChild(formRow);
    modalOverlay.appendChild(modalContent);
    modalRoot.appendChild(modalOverlay);

    modalRoot.style.display = 'flex';
    document.body.classList.add("noScroll");
    document.body.appendChild(modalRoot);

    cancelButton.focus();
  });
}

export interface InputConfig {
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export async function promptModal(
  messageHeader: string,
  inputs: Array<string | InputConfig>,
  buttonText: string,
  modalRequired: boolean = false,
  inputValues?: string[],
): Promise<string[] | null> {
  if (inputValues && inputValues.length !== inputs.length) {
    throw new Error(
      `Length of inputValues (${inputValues.length}) does not match length of inputs (${inputs.length}).`
    );
  }

  return new Promise((resolve) => {
    const modalRoot = makeElement("div", "modal-root", null, null);
    const modalOverlay = makeElement("div", null, "modal-overlay", null);
    const modalContent = makeElement("div", null, "modal-content", null);

    const modalH2 = makeElement("h2", null, null, messageHeader);
    modalH2.style.whiteSpace = "pre-line";
    modalContent.appendChild(modalH2);

    const inputElements: HTMLInputElement[] = [];

    inputs.forEach((inputConfig, index) => {
      const config: InputConfig =
        typeof inputConfig === "string" ? { placeholder: inputConfig } : inputConfig;

      const formRow = makeElement("div", null, "form-row", null);
      const userInput = document.createElement("input") as HTMLInputElement;
      userInput.type = "text";
      userInput.placeholder = config.placeholder || "";

      userInput.value = inputValues?.[index] ?? config.defaultValue ?? "";

      userInput.id = `userInput_${index}`;
      userInput.name = `userInput_${index}`;

      if (config.required) {
        userInput.required = true;
      }

      formRow.appendChild(userInput);
      modalContent.appendChild(formRow);
      inputElements.push(userInput);
    });

    const buttonRow = makeElement("div", null, "button-row", null);

    const closeModal = () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("noScroll");
      if (document.body.contains(modalRoot)) {
        document.body.removeChild(modalRoot);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !modalRequired) {
        closeModal();
        resolve(null);
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = modalContent.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const submitBtn = createButton({ buttonText: buttonText, buttonType: "button", buttonId: "submit-btn", buttonClass: "accent-button" });
    submitBtn.onclick = function () {
      for (const input of inputElements) {
        if (input.required && !input.value.trim()) {
          input.reportValidity?.();
          input.focus();
          return;
        }
      }

      const results = inputElements.map((input) => input.value);
      closeModal();
      resolve(results);
    };

    if (!modalRequired) {
      const cancelButton = createButton({ buttonText: "Cancel", buttonType: "button", buttonId: "cancel-btn", buttonClass: "accent-button", icon: "close", i18n: "button_cancel" });
      cancelButton.onclick = function () {
        closeModal();
        resolve(null);
      };
      buttonRow.appendChild(cancelButton);
    }
    buttonRow.appendChild(submitBtn);
    modalContent.appendChild(buttonRow);
    modalOverlay.appendChild(modalContent);
    modalRoot.appendChild(modalOverlay);

    modalRoot.style.display = "flex";
    document.body.classList.add("noScroll");
    document.body.appendChild(modalRoot);

    if (inputElements.length > 0) {
      inputElements[0].focus();
    } else {
      submitBtn.focus();
    }
  });
}

export function createGiveButterWidget(id: string | null, type: string) {
  const widget = document.createElement("givebutter-widget");
  if (type === "button") {
    if (id) {
      widget.setAttribute("id", id);
    } else {
      widget.setAttribute("id", "gRGya8");
    }
  } else {
    if (id) {
      widget.setAttribute("id", id);
    } else {
      widget.setAttribute("id", "goeb69");
    }
  }
  return widget;

}

export function createInputRow(labelText: string | null, inputType: string, placeholderText: string, id: string): HTMLElement {
  const formRow = makeElement("div", null, "form-row", null);
  if (labelText) {
    const label = document.createElement("label");
    label.textContent = labelText;
    label.setAttribute("for", id);
    formRow.appendChild(label);
  }
  const input = document.createElement("input") as HTMLInputElement;
  input.type = inputType;
  input.placeholder = placeholderText;
  input.id = id;
  input.name = id;
  formRow.appendChild(input);

  return formRow;
}

export function createTableRow(dataRow: (string | number | null)[]): HTMLTableRowElement {
  const tr = document.createElement("tr");
  dataRow.forEach((value) => {
    const td = document.createElement("td");
    if (!value) {
      td.textContent = "";
    } else {
      td.textContent = value.toString();
    }
    tr.appendChild(td);
  });

  return tr;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Text successfully copied to clipboard!');
    createMessage({ messageBody: "Copied to clipboard", location: "main-message", type: "check_circle", i18n: "copied_to_clipboard" })
  } catch (error) {
    createMessage({ messageBody: `Failed to copy text to clipboard: ${error}`, location: "main-message", type: "error" });
  }
}

export function donateListModal(
  messageHeader: string,
  projects: ProjectInfo[]
): Promise<ProjectInfo | null> {
  return new Promise((resolve) => {
    const modalRoot = makeElement("div", "modal-root", null, null);
    const modalOverlay = makeElement("div", null, "modal-overlay", null);
    const modalContent = makeElement("div", null, "modal-content", null);

    const modalH2 = makeElement("h2", null, null, messageHeader);
    modalH2.style.whiteSpace = "pre-line";
    modalContent.appendChild(modalH2);

    const closeModal = () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (document.body.contains(modalRoot)) {
        document.body.removeChild(modalRoot);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        resolve(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // List Container
    const listContainer = makeElement("div", null, "donate-modal-list", null);

    projects.forEach((project) => {
      const projectButton = makeElement(
        "button",
        null,
        "donate-option-btn accent-button",
        project.projectName
      ) as HTMLButtonElement;
      projectButton.type = "button";

      projectButton.onclick = () => {
        closeModal();
        resolve(project);
      };

      listContainer.appendChild(projectButton);
    });

    modalContent.appendChild(listContainer);

    // Cancel Button
    const buttonRow = makeElement("div", null, "button-row right", null);
    const cancelButton = makeElement(
      "button",
      null,
      "cancel-btn accent-button",
      "Cancel"
    ) as HTMLButtonElement;
    cancelButton.type = "button";
    cancelButton.onclick = () => {
      closeModal();
      resolve(null);
    };

    buttonRow.appendChild(cancelButton);
    modalContent.appendChild(buttonRow);

    modalOverlay.appendChild(modalContent);
    modalRoot.appendChild(modalOverlay);

    modalRoot.style.display = "flex";
    document.body.appendChild(modalRoot);
  });
}

export function createGoalBar(raised: number, goal: number) {
  const goalBar = makeElement("div", "custom-goal-bar", null, null);
  const progressFill = makeElement("div", "progress-fill", "progress-fill", null);
  const percentage = Math.min(Math.round((raised / goal) * 100), 100);
  progressFill.style.width = `${percentage}%`;
  goalBar.appendChild(progressFill);
  return goalBar;
}

export function calcAge(dateOfBirth: any): number {
    if (!dateOfBirth) return 0;

    let birthDate: Date;
    if (typeof dateOfBirth.toDate === "function") {
        birthDate = dateOfBirth.toDate();
    } else if (!(dateOfBirth instanceof Date)) {
        birthDate = new Date(dateOfBirth);
    } else {
        birthDate = dateOfBirth;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}