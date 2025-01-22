/**
 * Manages the canvas element and its rendering context.
 * Handles resizing and scaling for high-DPI displays.
 */
export function setupCanvas() {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");

    /**
     * Resizes the canvas to match the window dimensions and scales it for high-DPI displays.
     */
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.scale(dpr, dpr); // Scale the context to match the device pixel ratio
    }

    // Resize the canvas when the window is resized
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas(); // Initial resize

    // Return the canvas and context for external use
    return { canvas, ctx };
}
