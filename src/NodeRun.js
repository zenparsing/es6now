import * as FS from "node:fs";
import * as REPL from "node:repl";
import * as VM from "node:vm";
import * as Path from "node:path";
import * as Util from "node:util";

import { ConsoleStyle as Style } from "zen-cmd";
import { parse } from "esparse";
import { translate } from "./Translator.js";
import { isPackageSpecifier, locateModule } from "./Locator.js";

var Module = module.constructor;

export function formatSyntaxError(e, filename) {

    var msg = e.message,
        text = e.sourceText;

    if (filename === void 0 && e.filename !== void 0)
        filename = e.filename;

    if (filename)
        msg += `\n    ${filename}:${e.line}`;

    if (e.lineOffset < text.length) {

        var code = "\n\n" +
            text.slice(e.lineOffset, e.startOffset) +
            Style.bold(Style.red(text.slice(e.startOffset, e.endOffset))) +
            text.slice(e.endOffset, text.indexOf("\n", e.endOffset)) +
            "\n";

        msg += code.replace(/\n/g, "\n    ");
    }

    return msg;
}

function addExtension() {

    var moduleLoad = Module._load;

    Module.prototype.importSync = function(path) {

        if (/^node:/.test(path)) {

            path = path.slice(5);
            this.__es6 = false;

        } else {

            this.__es6 = true;
        }

        var e = this.require(path);
        if (e && e.constructor !== Object) e.default = e;
        return e;
    };

    Module._load = (request, parent, isMain) => {

        if (parent.__es6) {

            var loc = locateModule(request, Path.dirname(parent.filename));

            request = loc.path;

            if (loc.legacy)
                parent.__es6 = false;
        }

        var m = moduleLoad(request, parent, isMain);
        parent.__es6 = false;
        return m;
    };

    // Compile ES6 js files
    require.extensions[".js"] = (module, filename) => {

        var text, source;

        try {

            text = source = FS.readFileSync(filename, "utf8");

            // Only translate as a module if the source module is requesting
            // via import syntax
            var m = !!module.parent.__es6;

            text = translate(text, { wrap: m, module: m, functionContext: !m });

        } catch (e) {

            if (e instanceof SyntaxError)
                e = new SyntaxError(formatSyntaxError(e, filename));

            throw e;
        }

        return module._compile(text, filename);
    };
}

export function runModule(path) {

    addExtension();

    if (isPackageSpecifier(path))
        path = "./" + path;

    var loc = locateModule(path, process.cwd());

    // "__load" is defined in the module wrapper and ensures that the
    // target is loaded as a module

    var m = __load(loc.path);

    if (m && typeof m.main === "function") {

        var result = m.main(process.argv);
        Promise.resolve(result).then(null, x => setTimeout($=> { throw x }, 0));
    }
}

export function startREPL() {

    // Node 0.10.x pessimistically wraps all input in parens and then
    // re-evaluates function expressions as function declarations.  Since
    // Node is unaware of class declarations, this causes classes to
    // always be interpreted as expressions in the REPL.
    var removeParens = process.version.startsWith("v0.10.");

    addExtension();

    console.log(`es6now ${ _es6now.version } (Node ${ process.version })`);

    var prompt = ">>> ", contPrompt = "... ";

    var repl = REPL.start({

        prompt,

        useGlobal: true,

        eval(input, context, filename, cb) {

            var text, result, script, displayErrors = false;

            // Remove wrapping parens for function and class declaration forms
            if (removeParens && /^\((class|function\*?)\s[\s\S]*?\n\)$/.test(input))
                input = input.slice(1, -1);

            try {

                text = translate(input, { module: false });

            } catch (x) {

                // Regenerate syntax error to eliminate parser stack
                if (x instanceof SyntaxError) {

                    // Detect multiline input
                    if (/^(Unexpected end of input|Unexpected token)/.test(x.message)) {

                        this.bufferedCommand = input + "\n";
                        this.displayPrompt();
                        return;
                    }

                    x = new SyntaxError(x.message);
                }

                return cb(x);
            }

            try {

                script = VM.createScript(text, { filename, displayErrors });

                result = repl.useGlobal ?
                    script.runInThisContext({ displayErrors }) :
                    script.runInContext(context, { displayErrors });

            } catch (x) {

                return cb(x);
            }

            if (result instanceof Promise) {

                // Without displayPrompt, asynchronously calling the "eval"
                // callback results in no text being displayed on the screen.

                var token = {};

                Promise.race([

                    result,
                    new Promise(a => setTimeout($=> a(token), 3000)),
                ])
                .then(x => {

                    if (x === token)
                        return void cb(null, result);

                    this.outputStream.write(Style.gray("(async) "));
                    cb(null, x);
                })
                .catch(err => cb(err, null))
                .then($=> this.displayPrompt());

            } else {

                cb(null, result);
            }
        }
    });

    // Override displayPrompt so that ellipses are displayed for
    // cross-line continuations

    if (typeof repl.displayPrompt === "function" &&
        typeof repl._prompt === "string") {

        var displayPrompt = repl.displayPrompt;

        repl.displayPrompt = function(preserveCursor) {

            this._prompt = this.bufferedCommand ? contPrompt : prompt;
            return displayPrompt.call(this, preserveCursor);
        };
    }

    function parseAction(input, module) {

        var text, ast;

        try {

            ast = parse(input, { module });
            text = Util.inspect(ast, { colors: true, depth: 10 });

        } catch (x) {

            text = x instanceof SyntaxError ?
                formatSyntaxError(x, "REPL") :
                x.toString();
        }

        console.log(text);
    }

    function translateAction(input, module) {

        var text;

        try {

            text = translate(input, { wrap: false, module: true });

        } catch (x) {

            text = x instanceof SyntaxError ?
                formatSyntaxError(x, "REPL") :
                x.toString();
        }

        console.log(text);
    }

    var commands = {

        "help": {

            help: "Show REPL commands",

            action() {

                var list = Object.keys(this.commands).sort(),
                    len = list.reduce((n, key) => Math.max(n, key.length), 0);

                list.forEach(key => {

                    var help = this.commands[key].help || "",
                        pad = " ".repeat(4 + len - key.length);

                    this.outputStream.write(key + pad + help + "\n");
                });

                this.displayPrompt();
            }

        },

        "translate": {

            help: "Translate an ES6 script to ES5 and show the result (es6now)",

            action(input) {

                translateAction(input, false);
                this.displayPrompt();
            }
        },

        "translateModule": {

            help: "Translate an ES6 module to ES5 and show the result (es6now)",

            action(input) {

                translateAction(input, true);
                this.displayPrompt();
            }
        },

        "parse": {

            help: "Parse a script and show the AST (es6now)",

            action(input) {

                parseAction(input, false);
                this.displayPrompt();
            }

        },

        "parseModule": {

            help: "Parse a module and show the AST (es6now)",

            action(input) {

                parseAction(input, true);
                this.displayPrompt();
            }

        },
    };

    if (typeof repl.defineCommand === "function")
        Object.keys(commands).forEach(key => repl.defineCommand(key, commands[key]));
}
