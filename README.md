## OPSWAT API FILE SCANNER
Wrapper on OPSWAT API for easy file scanning from the command line
## Instructions
```
npm install
```
then
```
node index.js [filename]
```

- Axios looks for a property on process.env called `API_KEY`
- Also must set `RUN=1` in env

If you create a .env file like:
```
API_KEY=98GH98GHSECRET
RUN=1
```
Node will add these properties to the environment automatically
