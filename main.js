import { createWebSocketClient } from "./websocket-client.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr); // Scale the context to match the device pixel ratio
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Initial resize

// Create a WebSocket client
const socket = createWebSocketClient("ws://localhost:8080");
