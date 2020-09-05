import {
    scaleTime,
    timeSecond,
    timeMinute,
    timeMillisecond,
    timeDay,
    timeMonth,
    timeYear,
    timeHour,
    timeWeek,
    timeFormat,
    axisBottom,
    scale,
    select,
    selectAll,
    selection,
    scaleLinear,
    zoomIdentity,
    svg,
    interpolate,
    ticks,
    tickFormat,
    tickStep,
    format,
    timeInterval,
    transpose,
    axisLeft,
    zoom,
    zoomTransform,
    interpolateZoom,
    range
} from 'd3/dist/d3';

import {rescaleX} from 'd3-scale';

import {default as tip} from 'd3-tip';

import * as $ from 'jquery';

class TimelineChart {
    constructor(element, data, opts, date, clips) {
        let self = this;

        this.element = element

        this.options = opts
        this.data = data;
        this.minDay = date.setHours(0, 0, 0, 0);
        this.maxDay = date.setDate(date.getDate() + 1);
        this.knownTime = {
            min: this.minDay,
            max: this.maxDay
        };

        this.elementWidth = this.options.width || element.width();
        this.elementHeight = this.options.height || element.height();

        this.margin = {
            top: 0,
            right: 0,
            bottom: 20,
            left: 0
        };
        this.width = this.elementWidth - this.margin.left - this.margin.right;
        this.height = this.elementHeight - this.margin.top - this.margin.bottom;
        this.groupWidth = this.options.hideGroupLabels ? 0 : 200;

        this.minZoom = 0.1;
        this.maxZoom = 10;
        this.currentZoom = zoom()
            .scaleExtent([this.minZoom, this.maxZoom])
            .on('zoom', (event) => this.zoomed(event, this))
        this.formatMillisecond = timeFormat(".%L");
        this.formatSecond = timeFormat(":%Ss");
        this.formatMinute = timeFormat("%-I:%M%p");
        this.formatHour = timeFormat("%-I %p");
        this.formatDay = timeFormat("%a %d");
        this.formatWeek = timeFormat("%b %d");
        this.formatMonth = timeFormat("%B");
        this.formatYear = timeFormat("%Y");
        this.customTimeFormat = function (date) {
            return (timeSecond(date) < date ? self.formatMillisecond
                : timeMinute(date) < date ? self.formatSecond
                    : timeHour(date) < date ? self.formatMinute
                        : timeDay(date) < date ? self.formatHour
                            : timeMonth(date) < date ? (timeWeek(date) < date ? self.formatDay : self.formatWeek)
                                : timeYear(date) < date ? self.formatMonth
                                    : self.formatYear)(date);
        }

        this.svgMain = element
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('svg')
            .on('wheel', function () {
                self.svgMain.call(self.currentZoom)
            })
            .on('mousemove', function () {
                self.svgMain.call(self.currentZoom)
            })
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
        this.svgMain
            .append('defs')
            .append('clipPath')
            .attr('id', 'chart-content')
            .append('rect')
            .attr('x', this.groupWidth)
            .attr('y', 0)
            .attr('height', this.height)
            .attr('width', this.width - this.groupWidth);
        this.svgMain
            .append('rect')
            .attr('class', 'chart-bounds')
            .attr('x', this.groupWidth)
            .attr('y', 0)
            .attr('height', this.height)
            .attr('width', this.width - this.groupWidth)

        if (this.options.enableLiveTimer) {
            this.now = this.svgMain
                .append('line')
                .attr("fill", "purple")
                .attr("stroke-width", 5)
                .attr('clip-path', 'url(#chart-content)')
                .attr('class', 'vertical-marker now')
                .attr("y1", 0).attr("y2", this.height);
        }

        this.new_tip = tip()
            .attr('class', 'd3-tip')
            .html(this.options.tip ? this.options.tip : "");

        this.fetchNewData(this.knownTime)
        this.setListeners();
    }

    setListeners() {
        let self = this;

        this.rebold();
        this.factor = 0;

        //View
        select("#timeline_domain")
            .select("span#time_left")
            .text(() => {
                return timeFormat("%b-%d, %y (%-I:%M%p) -")(self.x.domain()[0]);
            });
        select("#timeline_domain")
            .select("span#time_right")
            .text(() => {
                return timeFormat(" %b-%d, %y (%-I:%M%p) ")(self.x.domain()[1]);
            });
        select('#timeline_domain').on('click', function () {
            var update = self.intervals
                .selectAll('rect')
                .data(self.newData)
                .enter()
                .append('g').attr('clip-path', 'url(#chart-content)')
                .attr('class', 'item')
                .attr('transform', function (d, i) {
                    return 'translate(0, ' + self.groupHeight * i + ')';
                })
                .selectAll('.dot').data(function (d) {
                    return d.data.filter(function (_) {
                        return _.type === TimelineChart.TYPE.INTERVAL;
                    });
                })
                .enter()
                .append('rect')
                .attr('class', self.withCustom('interval'))
                .attr('width', function (d) {
                    return Math.max(self.options.intervalMinWidth, self.x(d.data[0].to) - self.x(d.data[0].from));
                }).attr('height', this.intervalBarHeight).attr('y', this.intervalBarMargin).attr('x', function (d) {
                    return self.x(d.data[0].from);
                });
            // selectAll('this.svgMain>*').remove();
        });
        let tooltip = $("body>#tooltip");
        $('#timeline_domain, #timeline_domain > *').mouseleave(function (event) {
            tooltip.css("opacity", 0)
        });
        $('#timeline_domain, #timeline_domain > *').mouseenter(function (event) {
            tooltip.css("transition-duration", 150)
                .css("opacity", 1)
                .css("width", "6.5rem")
                .css("height", "4rem")
                .css("line-height", "20px")
                .html(`<span>These times differ from UTC by <strong>${time.format('%-Z')(self.x.domain()[1])} </strong> hours.</span>`)
                .css("left", (event.pageX - 50) + "px")
                .css("top", (event.pageY - 150) + "px");
        });

        this.groupDotItems = this.svgMain
            .selectAll('.group-dot-item')
            .data(this.data)
            .enter()
            .append('g').attr('clip-path', 'url(#chart-content)')
            .attr('class', 'item')
            .attr('transform', function (d, i) {
                return 'translate(0, ' + self.groupHeight * i + ')';
            })
            .selectAll('.dot').data(function (d) {
                if (d.data == null) {
                    return false;
                }
                return d.data.filter(function (_) {
                    return _.type === TimelineChart.TYPE.POINT;
                });
            })
            .enter();


        this.dots = this.groupDotItems.append('circle')
            .attr('class', self.withCustom('dot'))
            .attr('cx', function (d) {
                return self.x(d.data[0].at);
            }).attr('cy', this.groupHeight / 2).attr('r', 5)
            .on('mouseover', this.new_tip.show)
            .on('mouseout', this.new_tip.hide);


        this.svgMain.call(this.new_tip);

        if (this.options.enableLiveTimer) {
            setInterval(this.updateNowMarker.apply(this), self.options.timerTickInterval);
        }


    }


    updateNowMarker() {
        var nowX = this.x(new Date());

        this.now.attr('x1', nowX).attr('x2', nowX);
    }

    withCustom(defaultClass) {
        let self = this;

        return function (d) {
            return d.customClass ? d.customClass + " " + defaultClass : defaultClass;
        };
    }

    setupClickListeners(color) {
        let self = this;

        this.svgMain.selectAll(color).on('click', async function (elem) {
            console.log("You clicked my rectangle.");

            // $.get(`/loadreadings_from_clip?clipid=${elem['id']}`, function (data) {
            //     var readings = JSON.parse(data);
            //     load_function(readings, elem['clip_src'])
            // })
        })
    }
    
    zoomed(event, self) {
        if (this.k == null) {
            this.k = 1;
        }

        this.k *= event.transform.k

        if (this.translateX == null) {
            self.translateX = 0;
        }
        if (event.sourceEvent.type==="mousemove")
        {
            event.transform.x = event.transform.k * event.transform.x - event.transform.x / this.k
            self.translateX = event.transform.x/this.k
            self.x = event.transform.translateX(self.x)
        }
        else if (event.sourceEvent.type==="wheel")
        {
            event.transform.x = event.transform.k * event.transform.x - event.transform.x / this.k
            event.transform.k = Math.sqrt(event.transform.k)

            $("#values").text(`original transform: ${event.transform}`)

            self.x.domain(self.x.domain())


            self.x = event.transform.rescaleX(self.x)

            this.translateX = self.x(self.translateX)
        }

        $("#values3").text(`x: ${event.transform.x} k: ${this.k}`)

        self.xAxis = axisBottom()
            .scale(this.x)
            .ticks(6)
            .tickFormat(this.customTimeFormat);

        $("#values2").text(`${self.x(0)}`)

        let insideSelf = self;

        console.log(`transform: ${event.transform.k}`)


        self.svgMain.select('.x.axis').call(self.xAxis);
        self.svgMain.selectAll('circle.dot').attr('cx', function (d) {
            return self.x(d.data[0].at);
        });
        self.svgMain.selectAll('rect.interval').attr('x', function (d) {
            return self.x(d.data[0].from);
        }).attr('width', function (d) {
            return Math.max(options.intervalMinWidth, insideSelf.x(d.data[0].to) - insideSelf.x(d.data[0].from));
        })


    }

    getTextPositionData(d) {
        this.textSizeInPx = this.textSizeInPx || this.getComputedTextLength();
        var from = self.x(d.data[0].from);
        var to = self.x(d.data[0].to);
        return {
            xPosition: from,
            upToPosition: to,
            width: to - from,
            textWidth: this.textSizeInPx
        };
    }

    fetchNewData(rangeTime) {
        const self = this;

        let vals = this.x && this.x.domain();
        if (vals) {
            this.minDay = vals[0]
            this.maxDay = vals[1]
        } else {
            this.minDay = rangeTime.min;
            this.maxDay = rangeTime.max;
        }

        this.rangeTime = rangeTime;

        if (rangeTime !== null) {
            if (this.minDay < rangeTime.min || this.maxDay > rangeTime.max) {
                if (this.minDay < rangeTime.min) {
                    this.rangeTime.min = this.minDay;
                    console.log(`\n\nnew min: ${this.rangeTime.min}`)
                }
                if (this.maxDay > rangeTime.max) {
                    this.rangeTime.max = this.maxDay;
                    console.log(`\n\nnew max: ${this.rangeTime.max}`)
                }
            } else {
                console.log(`\n\n did not update, no new min/max`);
            }
        } else {
            this.rangeTime = {
                min: this.minDay,
                max: this.maxDay
            };
            console.log(`\n\nnew min: ${this.rangeTime.min}`)
            console.log(`\n\nnew max: ${this.rangeTime.max}`)
        }

        this.x = scaleTime()
            .domain([this.rangeTime.min, this.rangeTime.max])
            .range([this.groupWidth, this.width]);
        this.xAxis = axisBottom()
            .scale(this.x)
            .ticks(6)
            .tickFormat(this.customTimeFormat);


        this.rebold()


        this.groupHeight = this.height / this.data.length;
        this.axisNodes = this.svgMain
            .append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + this.height + ')')
            .call(this.xAxis);
        this.axisNodes.selectAll('text').each(function () {
            if (this.textContent.includes('M')) {
                this.classList.add("DAY");
            }
        });

        //this.groupSection =
        this.svgMain
            .selectAll('.group-section')
            .attr('y1', function (d, i) {
                return self.groupHeight * (i + 1);
            }).attr('y2', function (d, i) {
            return self.groupHeight * (i + 1);
        })
            .data(this.data)
            .exit().remove()
            .enter()
            .append('line')
            .attr('class', 'group-section')
            .attr('x1', 0)
            .attr('x2', this.width)
            .attr('y1', function (d, i) {
                return self.groupHeight * (i + 1);
            })
            .attr('y2', function (d, i) {
                return self.groupHeight * (i + 1);
            });

        // this.groupLabels =
        this.svgMain
            .selectAll('.group-label')
            .attr('y', function (d, i) {
                return self.groupHeight * i + self.groupHeight / 2 + 5.5;
            })
            .data(this.data)
            .exit().remove()
            .enter()
            .append('text')
            .attr('class', 'group-label')
            .attr('x', 0)
            .attr('y', function (d, i) {
                return self.groupHeight * i + self.groupHeight / 2 + 5.5;
            })
            .attr('dx', '0.5em')
            .text(function (d) {
                return d.label;
            });

        // var lineSection =
        this.svgMain
            .append('line')
            .attr('x1', this.groupWidth)
            .attr('x2', this.groupWidth)
            .attr('y1', 0)
            .attr('y2', this.height)
            .attr('stroke', 'green');

        // this.groupIntervalItems =
        this.svgMain.selectAll('.group-interval-item')
            .data(this.data)
            .exit().remove()
            .selectAll("rect.interval")
            .data(function (d) {
                return d.data.filter(function (_) {
                    return _.type === TimelineChart.TYPE.INTERVAL;
                });
            })
            .append('text')
            .on("mouseover", function (d) {
                select(this)
                    .transition()
                    .duration(125)
                    .style("stroke-width", "2px")
                    .style("stroke", "black");
            }).on("mouseout", function (d) {
            if (select(this).classed("red-interval")) {
                select(this)
                    .transition()
                    .duration(100)
                    .style("stroke-width", "0")
                    .style("stroke", "red");
            } else if (select(this).classed("blue-interval")) {
                select(this)
                    .transition()
                    .duration(100)
                    .style("stroke-width", "0")
                    .style("stroke", "blue");
            } else {
                select(this)
                    .transition()
                    .duration(100)
                    .style("stroke-width", "0")
                    .style("stroke", "yellow");
            }
            });
            self.svgMain.selectAll('.interval-text').attr('x', function (d) {
                var positionData = getTextPositionData.call(this, d);
                if (positionData.upToPosition - self.groupWidth - 10 < positionData.textWidth) {
                    return positionData.upToPosition;
                } else if (positionData.xPosition < self.groupWidth && positionData.upToPosition > self.groupWidth) {
                    return self.groupWidth;
                }
                return positionData.xPosition;
            }).attr('text-anchor', function (d) {
                var positionData = getTextPositionData.call(this, d);
                if (positionData.upToPosition - self.groupWidth - 10 < positionData.textWidth) {
                    return 'end';
                }
                return 'start';
            }).attr('dx', function (d) {
                var positionData = getTextPositionData.call(this, d);
                if (positionData.upToPosition - self.groupWidth - 10 < positionData.textWidth) {
                    return -(positionData.width - positionData.textWidth) / 2;
                }
                return (positionData.width - positionData.textWidth) / 2;
            }).text(function (d) {
                var positionData = getTextPositionData.call(this, d);
                var percent = (positionData.width - options.textTruncateThreshold) / positionData.textWidth;
                if (percent < 1) {
                    if (positionData.width > options.textTruncateThreshold) {
                        return d.label.substr(0, Math.floor(d.label.length * percent)) + '...';
                    } else {
                        return '';
                    }
                }
                return d.label;
            })
            .text(function (d) {
                return d.label;
            })
            .attr('fill', 'white')
            .attr('class', self.withCustom('interval-text'))
            .attr('y', this.groupHeight / 2 + 5)
            .attr('x', function (d) {
                return self.x(d.data[0].from);
            })
            .attr('width', function (d) {
                return Math.max(options.intervalMinWidth,
                    self.x(d.data[0].to) - self.x(d.data[0].from));
            })
            .attr('height', this.intervalBarHeight)
            .attr('y', this.intervalBarMargin)
            .attr('x', function (d) {
                return self.x(d.data[0].from)
            })
            .enter()
            .append('rect')
            .attr('class', this.withCustom('interval'))
            .attr('width', function (d) {
                return Math.max(this.options.intervalMinWidth, self.x(d.data[0].to) - self.x(d.data[0].from));
            })
            .attr('height', this.intervalBarHeight)
            .attr('y', this.intervalBarMargin)
            .attr('x', function (d) {
                return self.x(d.data[0].from);
            })
            .on('mouseover', this.new_tip.show)
            .on('mouseout', this.new_tip.hide)
            .select("g[clip-path='url(#chart-content)]")
            .attr('transform', function (d, i) {
                return 'translate(0, ' + self.groupHeight * i + ')';
            })
            .enter().append('g')
            .attr('clip-path', 'url(#chart-content)')
            .attr('class', 'item')
            .attr('transform', function (d, i) {
                return 'translate(0, ' + self.groupHeight * i + ')';
            });

        this.intervalBarHeight = 0.8 * this.groupHeight;
        this.intervalBarMargin = (this.groupHeight - this.intervalBarHeight) / 2;

        this.setupClickListeners('.blue-interval');
        this.setupClickListeners('.yellow-interval');
        this.setupClickListeners('.red-interval');
    }

    scroll_movement(d, currentX, rangeTime) {
        let self = this;
        this.fetchNewData(rangeTime);
    }

    rebold() {
        select('g').selectAll("text")
            .filter(function () {
                let text = select(this).text();
                return should_bold(text)
            })
            .attr("font-weight", "bold");
    }
}

function should_bold(text) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].some(s => text.includes(s) ||
        (text.includes("12")) && !text.includes(":"));
}

TimelineChart.TYPE = {
    POINT: Symbol(),
    INTERVAL: Symbol()
};


$(document).ready(() => {
    let timeline;

    let newData = [
        {
            "label": "valor_cam2",
            "data": [
                {
                    "id": "5e694da7f6462f8c440dcf3b",
                    "from": "2020-08-01T22:44:23.000Z",
                    "to": "2020-08-01T22:44:44.000Z",
                    "customClass": "blue-interval",
                    "readingCount": 3,
                    "exactMatch": [],
                    "potMatch": [],
                    "clip_src": "5e5d1e9fda64b10fe5d9d107/5e694da7f6462f8c440dcf3b"
                },
            ]
        },
        {
            "label": "valor_cam2",
            "data": [
                {
                    "id": "5e694da7f6462f8c440dcf3b",
                    "from": "2020-08-01T23:44:23.000Z",
                    "to": "2020-08-01T23:44:44.000Z",
                    "customClass": "blue-interval",
                    "readingCount": 3,
                    "exactMatch": [],
                    "potMatch": [],
                    "clip_src": "5e5d1e9fda64b10fe5d9d107/5e694da7f6462f8c440dcf3b"
                },
            ]
        },
        {
            "label": "valor_cam2",
            "data": [
                {
                    "id": "5e694da7f6462f8c440dcf3b",
                    "from": "2020-08-02T22:44:23.000Z",
                    "to": "2020-08-02T22:44:44.000Z",
                    "customClass": "blue-interval",
                    "readingCount": 3,
                    "exactMatch": [],
                    "potMatch": [],
                    "clip_src": "5e5d1e9fda64b10fe5d9d107/5e694da7f6462f8c440dcf3b"
                },
            ]
        },
        {
            "label": "valor_cam2",
            "data": [
                {
                    "id": "5e694da7f6462f8c440dcf3b",
                    "from": "2020-08-03T22:44:23.000Z",
                    "to": "2020-08-03T22:44:44.000Z",
                    "customClass": "blue-interval",
                    "readingCount": 3,
                    "exactMatch": [],
                    "potMatch": [],
                    "clip_src": "5e5d1e9fda64b10fe5d9d107/5e694da7f6462f8c440dcf3b"
                },
            ]
        },
        {
            "label": "valor_cam2",
            "data": [
                {
                    "id": "5e694da7f6462f8c440dcf3b",
                    "from": "2020-09-02T23:44:23.000Z",
                    "to": "2020-09-02T23:44:44.000Z",
                    "customClass": "blue-interval",
                    "readingCount": 3,
                    "exactMatch": [],
                    "potMatch": [],
                    "clip_src": "5e5d1e9fda64b10fe5d9d107/5e694da7f6462f8c440dcf3b"
                },
            ]
        },
    ];

    newData.map((element, i) => {
        newData[i].data[0].from = new Date(element.data[0].from);
        newData[i].data[0].to = new Date(element.data[0].to);
    })

    let config = {
        width: 1000,
        height: 100,
        hideGroupLabels: true,
        enableLiveTimer: true,
        intervalMinWidth: 8, // px
        textTruncateThreshold: 30,
        timerTickInterval: 1000
    }
    try {
        timeline = new TimelineChart(
            select("svg#timeline-chart"),
            newData,
            config,
            new Date(2020, 8, 1),
            [])
    } catch (e) {
        console.log(e);
    }

    window.timeline = timeline;
});
