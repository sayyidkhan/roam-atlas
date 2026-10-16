// jsdom does not implement the native dialog methods. Focus trapping and native
// Escape handling are verified in the browser; this fixture models open/close.
export function installDialogFixture() {
  const prototype = HTMLDialogElement.prototype;
  const originalShow = Object.getOwnPropertyDescriptor(prototype, "showModal");
  const originalClose = Object.getOwnPropertyDescriptor(prototype, "close");
  Object.defineProperty(prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); } });
  return () => {
    if (originalShow) Object.defineProperty(prototype, "showModal", originalShow);
    else Reflect.deleteProperty(prototype, "showModal");
    if (originalClose) Object.defineProperty(prototype, "close", originalClose);
    else Reflect.deleteProperty(prototype, "close");
  };
}
