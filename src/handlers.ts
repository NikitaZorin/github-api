import { DataBase } from './db';
import { IncomingMessage, ServerResponse } from 'http';
import * as dotenv from 'dotenv';
import querystring from 'querystring';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

interface EnvVariables {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    REDIRECT_URI: string;
}


let accessToken: any = "";
export class Handler {
    private res: ServerResponse;
    private req: IncomingMessage;
    private env: EnvVariables;

    constructor(res: ServerResponse, req: IncomingMessage) {
        this.res = res;
        this.req = req;
        dotenv.config();
        this.env = this.validateEnvVariables(process.env);
    }

    private validateEnvVariables(env: NodeJS.ProcessEnv): EnvVariables {
        const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = env;

        if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
            throw new Error('Missing required environment variables.');
        }

        return {
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        };
    }

    public home() {
        this.res.writeHead(200, { 'Content-Type': 'text/html' });
        this.res.end('<a href="/login">Login with GitHub</a>');
    }

    public login() {
        this.res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?client_id=${this.env.CLIENT_ID}&redirect_uri=${this.env.REDIRECT_URI}` });
        this.res.end();
    }

    public callback(db: DataBase) {

        if (this.req.url) {
            const { code } = querystring.parse(this.req.url.split('?')[1]);

            const data = querystring.stringify({
                client_id: this.env.CLIENT_ID,
                client_secret: this.env.CLIENT_SECRET,
                code,
            });

            const options = {
                hostname: 'github.com',
                path: '/login/oauth/access_token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': data.length
                },
            };

            const githubReq = https.request(options, (githubRes) => {
                githubRes.setEncoding('utf8');
                let rawData = '';
                githubRes.on('data', (chunk) => {
                    rawData += chunk;
                });
                githubRes.on('end', () => {
                    const parsedData = querystring.parse(rawData);
                    accessToken = parsedData.access_token;

                    const sessionId = uuidv4();
                    db.create(sessionId, accessToken);

                    this.res.writeHead(302, { Location: `/repositories?sessionId=${sessionId}` });
                    this.res.end();
                });
            });

            githubReq.on('error', (err) => {
                console.error(err);
                this.res.writeHead(500, { 'Content-Type': 'text/plain' });
                this.res.end('Internal Server Error');
            });

            githubReq.write(data);
            githubReq.end();
        } else {
            this.res.writeHead(400, { 'Content-Type': 'text/plain' });
            this.res.end('Bad Request');
        }
    }


    public repositories(db: DataBase) {

        const sessionId = this.getSessionIdFromRequest();

            db.get(sessionId, (accessToken) => {

                if (!accessToken) {
                    this.res.writeHead(302, { Location: '/' });
                    this.res.end();
                } else {
                    this.fetchRepositories(accessToken)
                    .then((repositories: any) => {
                      const commitsPromises = repositories.map((repo: any) =>
                        this.fetchCommits(accessToken, repo.owner.login, repo.name)
                          .then((commits: any) => {
                            repo.commitsCount = commits.length;
                            return repo;
                          })
                      );
          
                      Promise.all(commitsPromises)
                        .then((repositoriesWithCommits: any) => {
                          const totalCommits = repositoriesWithCommits.reduce((total: number, repo: any) => total + repo.commitsCount, 0);
          
                          const repositoriesWithRatio = repositoriesWithCommits.map((repo: any) => ({
                            ...repo,
                            commitsPercent: (repo.commitsCount / totalCommits) * 100,
                          }));
          
                          this.res.writeHead(200, { 'Content-Type': 'application/json' });
                          this.res.end(JSON.stringify(repositoriesWithRatio));
                        })
                        .catch((err: any) => {
                          console.error(err);
                          this.res.writeHead(500, { 'Content-Type': 'text/plain' });
                          this.res.end('Internal Server Error');
                        });
                    })
                    .catch((err: any) => {
                      console.error(err);
                      this.res.writeHead(500, { 'Content-Type': 'text/plain' });
                      this.res.end('Internal Server Error');
                    });
                }
            });
    }

    private fetchRepositories(accessToken: string): Promise<any> {
        const options = {
          hostname: 'api.github.com',
          path: '/user/repos',
          method: 'GET',
          headers: {
            'User-Agent': 'Node.js',
            Authorization: `Bearer ${accessToken}`,
          },
        };
    
        return new Promise((resolve, reject) => {
          const githubReq = https.request(options, (githubRes) => {
            githubRes.setEncoding('utf8');
            let rawData = '';
            githubRes.on('data', (chunk) => {
              rawData += chunk;
            });
            githubRes.on('end', () => {
              const repositories = JSON.parse(rawData);
              resolve(repositories);
            });
          });
    
          githubReq.on('error', (err) => {
            reject(err);
          });
    
          githubReq.end();
        });
    }


    private fetchCommits(accessToken: string, owner: string, repo: string): Promise<any> {
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}/commits`,
          method: 'GET',
          headers: {
            'User-Agent': 'Node.js',
            Authorization: `Bearer ${accessToken}`,
          },
        };
    
        return new Promise((resolve, reject) => {
          const githubReq = https.request(options, (githubRes) => {
            githubRes.setEncoding('utf8');
            let rawData = '';
            githubRes.on('data', (chunk) => {
              rawData += chunk;
            });
            githubRes.on('end', () => {
              const commits = JSON.parse(rawData);
              resolve(commits);
            });
          });
    
          githubReq.on('error', (err) => {
            reject(err);
          });
    
          githubReq.end();
        });
    }


    private getSessionIdFromRequest(): string | null {
        if (this.req.url) {
          const urlParams = new URLSearchParams(this.req.url.split('?')[1]);
          return urlParams.get('sessionId') || null;
        }
        return null;
      }



    public notFoundHandler() {
        this.res.writeHead(404, { 'Content-Type': 'text/plain' });
        this.res.end('Not Found');
    }


}

