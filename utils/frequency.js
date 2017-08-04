module.exports = {
        countThem: function(big_array) {
            var names_array = [];
            for (var i = 0; i < big_array.length; i++) {
                names_array.push( Object.assign({}, big_array[i]) );
            }

            function outerHolder(item_array) {
                if (item_array.length > 0) {
                var occurrences = [];
                var counter = 0;
                var bgarlen = item_array.length;
                item_array.sort(function(a, b) { return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0); });

                function recursiveCounter() {
                    occurrences.push(item_array[0]);
                    item_array.splice(0, 1);
                    var last_occurrence_element = occurrences.length - 1;
                    var last_occurrence_entry = occurrences[last_occurrence_element].name;
                    var occur_counter = 0;
                    var quantity_counter = 0;
                    for (var i = 0; i < occurrences.length; i++) {
                    if (occurrences[i].name === last_occurrence_entry) {
                        occur_counter = occur_counter + 1;
                        if (occur_counter === 1) {
                        quantity_counter = occurrences[i].quantity;
                        } else {
                        quantity_counter = quantity_counter + occurrences[i].quantity;
                        }
                    }
                    }

                    if (occur_counter > 1) {
                    var current_match = occurrences.length - 2;
                    occurrences[current_match].quantity = quantity_counter;
                    occurrences.splice(last_occurrence_element, 1);
                    }

                    counter = counter + 1;

                    if (counter < bgarlen) {
                    recursiveCounter();
                    }
                }

                recursiveCounter();

                return occurrences;
                }
            }
            console.log(JSON.stringify(outerHolder(names_array)));
        }
}