    function multiplySumArc(maskCanvas, data, dims, center_x_coord, center_y_coord, r1_coord, r2_coord) {
         //var maskCanvas = document.getElementById('mask');
         var dxpos = (dims.xmax - dims.xmin) / (dims.xdim);
         var dypos = (dims.ymax - dims.ymin) / (dims.ydim);
         var center_x = (center_x_coord - dims.xmin) / dxpos;
         var center_y = (dims.ymax - center_y_coord) / dypos;
         var r1 = r1_coord / dxpos; // square pixels only!
         var r2 = r2_coord / dxpos; // square pixels only!
         
         var ch = maskCanvas.height;
         var cw = maskCanvas.width;
         var maskCtx = maskCanvas.getContext('2d');
         var angle_start = radians(-10.5);
         var stepsize = radians(PHI_STEP);
         var steps = Math.PI * 2.0 / stepsize + 1;
         var width = Math.abs(r2 - r1);
         var r = (r1 + r2) / 2.0;
         var angle=angle_start, maskData, sum, normalize, data;
         maskCtx.fillStyle='#000000'; // for erasing
         maskCtx.strokeStyle = '#ffffff'; // for drawing
         maskCtx.lineWidth = width;
         var angle_list=[], sum_list=[], normalize_list=[], xy_list=[];
         var max_x, max_y, min_x, min_y, x1, x2, y1, y2, dx, dy;
         var buffer_pixels = 3; // border around selection rectangle
         maskCtx.fillRect(0,0,cw,ch);
         for (var s=0; s<steps; s++) {            
            maskCtx.beginPath();
            maskCtx.arc(center_x, center_y, r, -angle, -(angle + stepsize), true);
            maskCtx.stroke();
            // assuming small steps: linear!
            x1 = center_x + (Math.cos(angle) * r1); 
            y1 = center_y - (Math.sin(angle) * r1); // plus is down
            x2 = center_x + (Math.cos(angle + stepsize) * r1);
            y2 = center_y - (Math.sin(angle + stepsize) * r1);
            x3 = center_x + (Math.cos(angle) * r2); 
            y3 = center_y - (Math.sin(angle) * r2); // plus is down
            x4 = center_x + (Math.cos(angle + stepsize) * r2);
            y4 = center_y - (Math.sin(angle + stepsize) * r2);
            x1 = Math.round(x1);
            x2 = Math.round(x2);
            y1 = Math.round(y1);
            y2 = Math.round(y2);
            x3 = Math.round(x3);
            x4 = Math.round(x4);
            y3 = Math.round(y3);
            y4 = Math.round(y4);
            max_x = Math.min(cw, Math.max(x1, x2, x3, x4) + buffer_pixels);
            min_x = Math.max(0, Math.min(x1, x2, x3, x4) - buffer_pixels);
            max_y = Math.min(ch, Math.max(y1, y2, y3, y4) + buffer_pixels);
            min_y = Math.max(0, Math.min(y1, y2, y3, y4) - buffer_pixels);
            dx = max_x - min_x;
            dy = max_y - min_y;
            //console.log(min_x, max_x, min_y, max_y, dx, dy);
            
            sum = 0;
            normalize = 0;
            
            if (dx > 0 && dy > 0) {                
                var maskData = maskCtx.getImageData(min_x,min_y,dx,dy).data;
                //data = imgCtx.getImageData(min_x,min_y,dx,dy).data;
                
                for (var i=0; i<dx; i++) {
                    for (var j=0; j<dy; j++) {
                        var mi = (j*dx + i) * 4;
                        var n = maskData[mi];
                        normalize += n;
                        //sum += maskData[mi] * data[min_y + j][min_x + i];
                        sum += n * data[ch - min_y - j -1][min_x + i];
                    }
                }
            }
            angle_list[s] = angle;
            sum_list[s] = sum;
            normalize_list[s] = normalize;
            xy_list[s] = [degrees(angle), (normalize == 0)? NaN : sum/normalize];
            angle += stepsize;
            maskCtx.fillRect(min_x,min_y,dx,dy);
         }
         return {xy: xy_list, angle: angle_list, sum: sum_list, normalize: normalize_list}
    }
    
    function multiplySumRadial(maskCanvas, data, dims, center_x_coord, center_y_coord) {
         var dxpos = (dims.xmax - dims.xmin) / (dims.xdim);
         var dypos = (dims.ymax - dims.ymin) / (dims.ydim);
         var center_x = (center_x_coord - dims.xmin) / dxpos;
         //var center_y = (center_y_coord - dims.ymin) / dypos;
         var center_y = (dims.ymax - center_y_coord) / dypos;
         
         var ch = maskCanvas.height;
         var cw = maskCanvas.width;
         var maskCtx = maskCanvas.getContext('2d');
         var r_min = 1;
         var r_max = Math.sqrt(Math.max(
            Math.pow((center_x - 0), 2) + Math.pow((center_y - 0), 2),
            Math.pow((center_x - 0), 2) + Math.pow((center_y - dims.ymax), 2),
            Math.pow((center_x - dims.xmax), 2) + Math.pow((center_y - dims.ymax), 2),
            Math.pow((center_x - dims.xmax), 2) + Math.pow((center_y - 0), 2)
         ));
         var stepsize = 1;
         var steps = (r_max - r_min)/ stepsize + 1;
         var width = 1.0; // integration step for radial
         maskCtx.fillStyle='#000000'; // for erasing
         maskCtx.strokeStyle = '#ffffff'; // for drawing
         maskCtx.lineWidth = width;
         var radius_list=[], sum_list=[], normalize_list=[], xy_list=[];
         var r, max_x, max_y, min_x, min_y, x1, x2, y1, y2, dx, dy;
         var tau = Math.PI * 2.0;
         var buffer_pixels = 3; // border around selection rectangle
         maskCtx.fillRect(0,0,cw,ch);
         for (var s=0; s<steps; s++) {            
            maskCtx.beginPath();
            r = r_min + s*stepsize;
            maskCtx.arc(center_x, center_y, r, 0, tau);
            maskCtx.stroke();
            // assuming small steps: linear!
            x1 = center_x + r; 
            y1 = center_y - r; // plus is down
            x2 = center_x - r;
            y2 = center_y + r;
            x1 = Math.round(x1);
            x2 = Math.round(x2);
            y1 = Math.round(y1);
            y2 = Math.round(y2);
            max_x = Math.min(cw, Math.max(x1, x2) + buffer_pixels);
            min_x = Math.max(0, Math.min(x1, x2) - buffer_pixels);
            max_y = Math.min(ch, Math.max(y1, y2) + buffer_pixels);
            min_y = Math.max(0, Math.min(y1, y2) - buffer_pixels);
            dx = max_x - min_x;
            dy = max_y - min_y;
            //console.log(min_x, max_x, min_y, max_y, dx, dy);
            
            sum = 0;
            normalize = 0;
            
            if (dx > 0 && dy > 0) {                
                var maskData = maskCtx.getImageData(min_x,min_y,dx,dy).data;
                //data = imgCtx.getImageData(min_x,min_y,dx,dy).data;
                
                for (var i=0; i<dx; i++) {
                    for (var j=0; j<dy; j++) {
                        var mi = (j*dx + i) * 4;
                        var n = maskData[mi];
                        normalize += n;
                        //sum += maskData[mi] * data[min_y + j][min_x + i];
                        sum += n * data[ch - min_y - j - 1][min_x + i];
                    }
                }
            }
            radius_list[s] = r;
            sum_list[s] = sum;
            normalize_list[s] = normalize;
            xy_list[s] = [r, (normalize == 0)? NaN : sum/normalize];
            maskCtx.fillRect(min_x,min_y,dx,dy);
         }
         return {xy: xy_list, radius: radius_list, sum: sum_list, normalize: normalize_list}
    }
