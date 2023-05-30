import http from 'http';
import { App } from './app';

const server = http.createServer((req, res) => {
    const app = new App(req, res);
    app.handleRequest();
});


const port = 3000;

server.listen(port, () => {
    console.log('Server is running on http://localhost:3000');
});
