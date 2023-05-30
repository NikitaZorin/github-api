import { IncomingMessage, ServerResponse } from 'http';
import { Handler } from './handlers';
import { DataBase } from './db';




export class App {
    req: IncomingMessage;
    res: ServerResponse;
    db: DataBase;

    constructor(req: IncomingMessage, res: ServerResponse) {
        this.req = req;
        this.res = res;
        this.db = new DataBase();
    }

    handleRequest() {
        const handler = new Handler(this.res, this.req);
        if(this.req.url === '/') {
            handler.home();
        } else if (this.req.url === '/login') {
            handler.login();
        } else if  (this.req.url?.startsWith('/repositories')) {
            handler.repositories(this.db);
        } else if (this.req.url?.startsWith('/callback')){
            handler.callback(this.db);
        } else {
            handler.notFoundHandler();
        }
    }
}