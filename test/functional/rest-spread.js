export var tests = {

    "rest arguments" (test) {

        ((...args) => {

            test
            ._("rest argument is an Array")
            .assert(Array.isArray(args))
            ._("rest argument has the correct values")
            .equals(args, [1, 2, 3, 4, 5])
            ;

        })(1, 2, 3, 4, 5);
    },

    "spread call" (test) {

        ((...args) => {

            test
            ._("arrays can be spread into a function call")
            .equals(args, [1, 2, 3, 4, 5])
            ;

        })(1, ...[2, 3, 4], 5);

        var set = new Set;
        set.add(2);
        set.add(3);
        set.add(4);

        ((...args) => {

            test
            ._("iterables can be spread into a function call")
            .equals(args, [1, 2, 3, 4, 5])
            ;

        })(1, ...set.values(), 5);
    },

    "spread in array literals" (test) {

        var set = new Set;
        set.add(2);
        set.add(3);
        set.add(4);

        test
        ._("with an array")
        .equals([1, ...[2, 3, 4], 5], [1, 2, 3, 4, 5])
        ._("with an iterable")
        .equals([1, ...set.values(), 5], [1, 2, 3, 4, 5])
        ;
    },

};
