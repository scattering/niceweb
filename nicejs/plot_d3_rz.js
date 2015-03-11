function plotD3(target_id, data, options) {
    var defaultOptions = {
        log_x: false,
        log_y: false,
        show_line: true,
        show_points: true,
        vcursor: false,
        hcursor: false,
        xlabel: 'x-axis',
        ylabel: 'y-axis'
    }
    
    var options = options || {}, value = null;
    for (var key in defaultOptions) {
        if (!(key in options)) {
            options[key] = defaultOptions[key];
        }
    }
    
    var max_y = -Infinity;
    var min_y = Infinity;
    var max_x = -Infinity;
    var min_x = Infinity;
    
    var linf = function(x) { return x }
    var logf = function(x) { return Math.log(x) / Math.LN10 }
    
    var tx = options.log_x ? logf : linf;
    var ty = options.log_y ? logf : linf;
    
    var newy, newx;
    var labels = data.options.series.map(function(d) { return d.label });
    var transformed_data = [];
    
    for (var i=0; i<data.data.length; i++) {
        var newSet = data.data[i].map(
            function(p) {
                newx = tx(p[0]);
                newy = ty(p[1]);
                if (isFinite(newx) && isFinite(newy)) {
                    if (newx > max_x) max_x = tx(p[0]);
                    if (newx < min_x) min_x = tx(p[0]);
                //}
                //if (isFinite(newy)) {
                    if (newy > max_y) max_y = ty(p[1]);
                    if (newy < min_y) min_y = ty(p[1]); 
                //}
                    return {'x': newx, 'y': newy} 
                } else {
                    return null;
                }
            }
        );
        transformed_data.push(newSet);
    }
    
    data = transformed_data;
    
    var old_colors = [
	    'steelblue',
	    'green',
	    'red',
	    'purple'
    ]

    var colors = [
        "#4bb2c5", 
        "#EAA228", 
        "#c5b47f", 
        "#579575", 
        "#839557", 
        "#958c12", 
        "#953579", 
        "#4b5de4", 
        "#d8b83f", 
        "#ff5800", 
        "#0085cc", 
        "#c747a3", 
        "#cddf54", 
        "#FBD178", 
        "#26B4E3", 
        "#bd70c7"
    ] 
     
    //************************************************************
    // Create Margins and Axis and hook our zoom function
    //************************************************************
    
    var container = d3.select("#" + target_id).node();
    
    var margin = {top: 10, right: 10, bottom: 50, left: 50},
        width = container.clientWidth - margin.left - margin.right,
        height = container.clientHeight - margin.top - margin.bottom;
	
	var x = d3.scale.linear()
        .domain([min_x, max_x])
        .range([0, width]);
     
    var y = d3.scale.linear()
        .domain([min_y, max_y])
        .range([height, 0]);
	
    var xAxis = d3.svg.axis()
        .scale(x)
	    .tickSize(-height)
	    .ticks(5)
	    .tickPadding(10)	
	    .tickSubdivide(true)	
        .orient("bottom");	
	
    var yAxis = d3.svg.axis()
        .scale(y)
	    .tickPadding(10)
	    .ticks(5)
	    .tickSize(-width)
	    .tickSubdivide(true)	
        .orient("left");
    
    var zoom = d3.behavior.zoom().x(x).y(y).on("zoom", zoomed);

    var zoomRect = true;
    
    d3.select("#zoom-rect").on("change", function() {
      zoomRect = this.checked;
    });
    
    //************************************************************
    // Generate our SVG object
    //************************************************************	
    var svg = d3.select("#" + target_id).append("svg")
	    .call(zoom)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        //.attr("width", "100%")
        //.attr("height", "100%")
	    .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .call(zoom)
      .append("g")
        .on("mousedown", function() {
          if (!zoomRect) return;
          var e = this,
              origin = d3.mouse(e),
              rect = svg.append("rect").attr("class", "zoom");
          d3.select("body").classed("noselect", true);
          origin[0] = Math.max(0, Math.min(width, origin[0]));
          origin[1] = Math.max(0, Math.min(height, origin[1]));
          d3.select(window)
              .on("mousemove.zoomRect", function() {
                var m = d3.mouse(e);
                m[0] = Math.max(0, Math.min(width, m[0]));
                m[1] = Math.max(0, Math.min(height, m[1]));
                rect.attr("x", Math.min(origin[0], m[0]))
                    .attr("y", Math.min(origin[1], m[1]))
                    .attr("width", Math.abs(m[0] - origin[0]))
                    .attr("height", Math.abs(m[1] - origin[1]));
              })
              .on("mouseup.zoomRect", function() {
                d3.select(window).on("mousemove.zoomRect", null).on("mouseup.zoomRect", null);
                d3.select("body").classed("noselect", false);
                var m = d3.mouse(e);
                m[0] = Math.max(0, Math.min(width, m[0]));
                m[1] = Math.max(0, Math.min(height, m[1]));
                if (m[0] !== origin[0] && m[1] !== origin[1]) {
                  zoom.x(x.domain([origin[0], m[0]].map(x.invert).sort(function(a,b) {return a-b})))
                      .y(y.domain([origin[1], m[1]].map(y.invert).sort(function(a,b) {return a-b})));
                } else {
                    zoom.scale(1);
                    zoom.translate([0,0]);
                    zoom.x(x.domain([min_x, max_x]))
                        .y(y.domain([min_y, max_y]));
                }
                rect.remove();
                zoomed();
              }, true);
          d3.event.stopPropagation();
        });
    
//    d3.select(window).on("dblclick", 
//        function() { 
//            console.log('double click');
//        }
//    );
    
    svg.append("rect")
        .attr("width", width)
        .attr("height", height);
            
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("g")
	    .attr("class", "x axis")
	    .append("text")
	    .attr("class", "axis-label")
	    .attr("x", width/2.0)
	    .attr("text-anchor", "middle")
        .attr("y", height + 35)
	    .text(options.xlabel);
     
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);
     
    svg.append("g")
	    .attr("class", "y axis")
	    .append("text")
	    .attr("class", "axis-label")
	    .attr("text-anchor", "middle")
	    .attr("transform", "rotate(-90)")
	    .attr("y", (-margin.left) + 10)
	    .attr("x", -height/2)
	    .text(options.ylabel);	
     
    svg.append("defs").append("clipPath")
	    .attr("id", target_id + "_clip") // local def
	    .append("rect")
	    .attr("width", width)
	    .attr("height", height);
	
    //************************************************************
    // Create D3 legend
    //************************************************************	
	var legend = svg.append("g")
	  .attr("class", "legend")
	  .attr("x", width - 65)
	  .attr("y", 25)
	  .attr("height", 100)
	  .attr("width", 100);
	
	legend.selectAll('g').data(data)
      .enter()
      .append('g')
      .each(function(d, i) {
        var g = d3.select(this);
        g.append("rect")
          .attr("x", width - 65)
          .attr("y", i*25)
          .attr("width", 10)
          .attr("height", 10)
          .style("fill", colors[i%colors.length]);
        
        g.append("text")
          .attr("x", width - 50)
          .attr("y", i * 25 + 8)
          .attr("height",30)
          .attr("width",100)
          .style("fill", colors[i%colors.length])
          .text(labels[i])
          .on("mouseover", function() {
            d3.selectAll('.line')[0][i].classList.add('highlight');
          })
          .on("mouseout", function() {
            d3.selectAll('.line')[0][i].classList.remove('highlight');
          });
      });
	
    //************************************************************
    // Create D3 line object and draw data on our SVG object
    //************************************************************
    if (options.show_line) {
        var line = d3.svg.line()
            .defined(function(d) { return (d && isFinite(d.y)); })
            .interpolate("linear")	
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });		

        svg.selectAll('.line')
            .data(data)
            .enter()
            .append("path")
            .attr("class", "line")
            .attr("clip-path", "url(#"+target_id+"_clip)")
            .attr('stroke', function(d,i){ 			
	            return colors[i%colors.length];
            })
            .attr("d", line);
    } else {
        var line = null;
    }
	
	
	
	
    //************************************************************
    // Draw points on SVG object based on the data given
    //************************************************************
    if (options.show_points) {
        var points = svg.selectAll('.dots')
            //.defined(function(d) { return isFinite(d.y); })
	        .data(data)
	        .enter()
	        .append("g")
            .attr("class", "dots")
	        .attr("clip-path", "url(#"+target_id+"_clip)");
         
        points.selectAll('.dot')
	        .data(function(d, index){ 		
		        var a = [];
		        d.forEach(function(point,i){
		            if (point != null) {
			            a.push({'index': index, 'point': point});
			        }
		        });		
		        return a;
	        })
	        .enter()
	        .append('circle')
	        .attr('class','dot')
	        .attr("r", 2.5)
	        .attr('fill', function(d,i){ 	
		        return colors[d.index%colors.length];
	        })	
	        .attr("transform", function(d) { 
		        return "translate(" + x(d.point.x) + "," + y(d.point.y) + ")"; }
	        );
    } else {
        var points = null;
    }	
     
	
	
	
	
    //************************************************************
    // Zoom specific updates
    //************************************************************
    function zoomed() {
	    svg.select(".x.axis").call(xAxis);
	    svg.select(".y.axis").call(yAxis);   
	    if (line) svg.selectAll('path.line').attr('d', line);  
     
	    if (points) points.selectAll('circle').attr("transform", function(d) { 
		    return "translate(" + x(d.point.x) + "," + y(d.point.y) + ")"; }
	    );  
    }
    
    function refresh() {
      svg.select(".x.axis").call(xAxis);
      svg.select(".y.axis").call(yAxis);
    }
    
    //************************************************************
    // Vertical cursor (or horizontal)
    //************************************************************
    if (options.vcursor) {
        var vertical = d3.select("#"+target_id)
            .append("div")
            .attr("class", "remove vertical-cursor")
            .style("position", "absolute")
            .style("z-index", "19")
            .style("width", "1px")
            .style("height", height + "px")
            //.attr("transform", "translate(0," + margin.top + ")")
            .style("top", margin.top + 10 + "px")
            //.style("bottom", "30px")
            .style("left", "0px")
            .style("background", "#000");

        d3.select("#"+target_id)
          .on("mouseenter", function(){
             vertical.style("display", "block")})
          .on("mouseleave", function(){
             vertical.style("display", "none")})
          .on("mousemove", function(){  
             mousex = d3.mouse(this);
             mousex = mousex[0] + 5;
             vertical.style("left", mousex + "px" )})
          .on("mouseover", function(){  
             mousex = d3.mouse(this);
             mousex = mousex[0] + 5;
             vertical.style("left", mousex + "px")});
    }
    
    if (options.hcursor) {
        var horizontal = d3.select("#"+target_id)
            .append("div")
            .attr("class", "remove horizontal-cursor")
            .style("position", "absolute")
            .style("z-index", "19")
            .style("width", width + "px")
            .style("height", "1px")
            //.attr("transform", "translate(0," + margin.top + ")")
            .style("left", margin.left + 10 + "px")
            //.style("bottom", "30px")
            .style("top", "0px")
            .style("background", "#000");

        d3.select("#"+target_id)
          .on("mouseenter", function(){
             horizontal.style("display", "block")})
          .on("mouseleave", function(){
             horizontal.style("display", "none")})
          .on("mousemove", function(){  
             mousey = d3.mouse(this);
             mousey = mousey[1] + 5;
             horizontal.style("top", mousey + "px" )})
          .on("mouseover", function(){  
             mousey = d3.mouse(this);
             mousey = mousey[1] + 5;
             horizontal.style("top", mousey + "px")});
    }
    
    return svg;
}
