class Socket {
  async getSocketListObject(tableId) {
    // return await io.in(tableId.toString()).fetchSockets();

    const clients = io.sockets.adapter.rooms.get(tableId.toString());
    const socketClient = [];
    for (const clientId of clients) {
      socketClient.push(io.sockets.sockets.get(clientId));
    }
    return socketClient;
  }

  getSocketObjects(id) {
    return io.sockets.sockets.get(id);
  }
}

module.exports = Socket;
