"abcdefg";
"abc$efg";
"abc'efg";
"abc\"efg";
"abc" + (d) + "efg";
"abc\n\
\n\
\n\
efg";
"\"\"\"";
html(_es6now.callSite(["a", "b", "c\n"], ["a", "b", "c\\n"]), x, y);
html(_es6now.callSite(["a", "b\n\
", " c\u0060"], ["a", "b\n", " c\\u0060"]), x, y);
html(_es6now.callSite(["foo", ""]), bar);
