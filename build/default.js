import { spawn } from "node:child_process";

spawn(
    "es6now",
    "- ../src/default.js ../build/es6now.js -b -r".split(/ /g),
    { stdio: "inherit", cwd: __dirname });
