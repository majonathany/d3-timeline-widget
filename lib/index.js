import * as d3 from 'd3';
import * as $ from 'jquery';

let a = [1, 2, 3, 4, 5];

export default function main() {
    d3.select("#chart").style({ "border": "1px solid black",
        "width": "100%",
        "height": "20rem"
    });

    d3.select("#chart").select("rect").attr("fill", "red").attr("width", 50).attr("height", 20).enter(a).exit();

    console.log("Update");
}

$(document).ready(function () {
    $("#chart").style("background-color", "green");
    main();
});