/**
 * @param {Object} o
 * @param {Keyframe[]} o.keyframes
 * @param {KeyframeAnimationOptions} o.options
 */
export function animate({ keyframes = [], options = {} }) {
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

export const fade_animation = animate({
  keyframes: [{ opacity: 1 }, { opacity: 0 }],
  options: { duration: 200, fill: "forwards" },
});
