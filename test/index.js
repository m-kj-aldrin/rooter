import "../src/rooter.js";
import { RouteEvent } from "../src/rooter.js";

async function wait(ms = 0) {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, ms);
  });
}

/**
 * @param {Object} o
 * @param {Keyframe[]} o.keyframes
 * @param {KeyframeAnimationOptions} o.options
 */
function animate({ keyframes = [], options = {} }) {
  return {
    /**
     * @param {HTMLElement} element
     * @param {KeyframeAnimationOptions} [overide_options]
     */
    run: function (element, overide_options = {}) {
      let full_options = { ...options, ...overide_options };
      return element.animate(keyframes, full_options);
    },
    get settings() {
      return { keyframes, options };
    },
  };
}

let fade_animation = animate({
  keyframes: [{ opacity: 1 }, { opacity: 0 }],
  options: { duration: 200, fill: "forwards" },
});

/**@param {RouteEvent<"view-start">} e */
async function view_start_handler(e) {
  let view_animation = fade_animation.run(document.body);

  e.p = new Promise((res) => {
    view_animation.onfinish = () => res();
  });
}

/**@param {RouteEvent<"view-end">} e */
function view_end_handler(e) {
  let view_animation = fade_animation.run(document.body, {
    direction: "reverse",
  });
}

window.addEventListener("route-view-start", view_start_handler);
window.addEventListener("route-view-end", view_end_handler);
