// Function to create and manage a WebSocket connection
export function createWebSocketClient(url) {
  // Create a WebSocket connection to the server
  const socket = new WebSocket(url);

  // Connection opened
  socket.addEventListener("open", () => {
    console.log("Connected to the WebSocket server");
    socket.send("Hello Server!"); // Send a message to the server
  });

  // Listen for messages from the server
  socket.addEventListener("message", (data) => {
    console.log("Message from server:", data.toString());
  });

  // Handle errors
  socket.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  // Connection closed
  socket.addEventListener("close", () => {
    console.log("Disconnected from the WebSocket server");
  });

  // Return the socket instance for further use
  return socket;
}
