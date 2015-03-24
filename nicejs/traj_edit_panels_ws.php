<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NICE Trajectory Editor</title>
  <!--<link rel="stylesheet" href="http://code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css" />-->
  <!--<link rel="stylesheet" href="//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/themes/smoothness/jquery-ui.css" />-->
  <!--<link rel="stylesheet" href="//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/themes/redmond/jquery-ui.css" />-->
  <!--<script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>-->
  <!--<script src="//ajax.googleapis.com/ajax/libs/jqueryui/1.10.4/jquery-ui.min.js"></script>-->
  <link rel="stylesheet" href="//code.jquery.com/ui/1.10.4/themes/redmond/jquery-ui.css" />
  <link rel="stylesheet" href="css/layout-default-latest.css" />
  <script src="//code.jquery.com/jquery-1.11.1.min.js"></script> 
  <script src="//code.jquery.com/ui/1.10.4/jquery-ui.min.js"></script>
  
  <script type="text/javascript">
    if (typeof jQuery == 'undefined')
        {
            document.write(unescape("%3Cscript src='jquery-1.11.1.min.js' type='text/javascript'%3E%3C/script%3E"));
        }
        
    if (typeof jQuery.ui == 'undefined')
        {
            document.write(unescape("%3Cscript src='jquery-ui.min.js' type='text/javascript'%3E%3C/script%3E"));
        }
  </script>
<!--  <script src="http://code.jquery.com/jquery-1.9.1.js"></script>-->
<!-- <script src="http://code.jquery.com/ui/1.10.3/jquery-ui.js"></script>-->
  <script src="jquery.layout-latest.js"></script>  
  <script src="sprintf.js"></script>
  <script src="webtraj_base_prototype.js"></script>
  <script src="webtraj_interactive.js"></script>
  <script src="dryrun.js"></script>
  <script src="jsonpatch.js"></script>
  <script src="jsondiff.js"></script>
  
  <script src="../../niceweb/nicejs/icejs/Ice.js"></script>
  <script src="../../niceweb/nicejs/icejs/Glacier2.js"></script>
  <script src="../../niceweb/nicejs/icejs/IceStorm.js"></script>
  <script src="../../niceweb/nicejs/icejs/IceGrid.js"></script>

  <script src="../../niceweb/nicejs/generated/data.js"></script>
  <script src="../../niceweb/nicejs/generated/file.js"></script>
  <script src="../../niceweb/nicejs/generated/devices.js"></script>
  <script src="../../niceweb/nicejs/generated/console.js"></script>
  <script src="../../niceweb/nicejs/generated/dryrun.js"></script>
  <script src="../../niceweb/nicejs/generated/exceptions.js"></script>
  <script src="../../niceweb/nicejs/generated/nice.js"></script>
  <script src="../../niceweb/nicejs/generated/events.js"></script>
  <script src="../../niceweb/nicejs/generated/experiment.js"></script>
  <script src="../../niceweb/nicejs/generated/queue.js"></script>
  <script src="../../niceweb/nicejs/generated/sampleAlignment.js"></script>
  <script src="../../niceweb/nicejs/generated/clientapi.js"></script>
  <script src="../../niceweb/nicejs/connect_zeroc.js"></script>
  <link rel="stylesheet" href="webtraj.css" />
  <?php function get_client_ip() {
    $ipaddress = '';
    if (getenv('HTTP_CLIENT_IP'))
        $ipaddress = getenv('HTTP_CLIENT_IP');
    else if(getenv('HTTP_X_FORWARDED_FOR'))
        $ipaddress = getenv('HTTP_X_FORWARDED_FOR');
    else if(getenv('HTTP_X_FORWARDED'))
        $ipaddress = getenv('HTTP_X_FORWARDED');
    else if(getenv('HTTP_FORWARDED_FOR'))
        $ipaddress = getenv('HTTP_FORWARDED_FOR');
    else if(getenv('HTTP_FORWARDED'))
        $ipaddress = getenv('HTTP_FORWARDED');
    else if(getenv('REMOTE_ADDR'))
        $ipaddress = getenv('REMOTE_ADDR');
    else
        $ipaddress = 'UNKNOWN';

    return $ipaddress;
    }
  ?>
  <script type="text/javascript">
  <?php 
    echo("REQUESTOR_IP = '");
    echo(get_client_ip());
    echo("';");
  ?>
  </script>
  <script type="text/javascript">
    var Promise = Ice.Promise;
    var RouterPrx = Glacier2.RouterPrx;
    var api;
    var instrument_canonical_ip = {
        '129.6.120.90': 'magik.ncnr.nist.gov',
        '129.6.120.84': 'pbr.ncnr.nist.gov',
        '129.6.120.121': 'ngbsans.ncnr.nist.gov',
        '129.6.120.247': 'echo.ncnr.nist.gov',
        '129.6.120.94': 'bt4.ncnr.nist.gov',
        '129.6.123.130': 'h123130.ncnr.nist.gov',
        '129.6.120.111': 'ng7refl.ncnr.nist.gov',
        '129.6.123.10': 'h123010.ncnr.nist.gov'
    }
    NICE_HOST = REQUESTOR_IP;
    if (NICE_HOST in instrument_canonical_ip) {
        NICE_HOST = instrument_canonical_ip[NICE_HOST];
    } else {
        // for testing, punt to MAGIK VM
        NICE_HOST = 'h123062.ncnr.nist.gov'; 
    }
    
  </script>
  <script type="text/javascript" src="webtraj_page_websocket.js"></script>
  <style type="text/css">
    #files {
        overflow: hidden;
    }
  </style>
  <script type="text/javascript">
    $(document).ready(function () {
	    //$('body').layout({ applyDemoStyles: true });
	    var layout = $('body').layout({
			west__size:			300
		,	east__size:			0
		,   south__size:        "auto"
			// RESIZE Accordion widget when panes resize
		,	west__onresize:		$.layout.callbacks.resizePaneAccordions
		,	east__onresize:		$.layout.callbacks.resizePaneAccordions
		,	south__onresize:		$.layout.callbacks.resizePaneAccordions
		});
		
		var eb = $('#catalog');
    
        update_interactiveness = function() {
            var interactive = document.getElementById('interactive').checked;
            if (!(interactive)) { 
                eb.hide(); 
            } else {
                eb.show();
            }
            if (wt.raw) { // && wt.filename) {
                var filename = wt.filename;
                var new_editor = set_data(wt.raw);
                new_editor.filename = filename;
            }
            layout.resizeAll();
        }
        
        var hostname = document.location.hostname || "127.0.0.1";
        getDevices().then(refreshBoth);
    
    });
  </script>
</head>
<body>

<div id="files" class="ui-layout-wrapper ui-layout-west">
     <h3 class="ui-widget-header" style="display:block;">Trajectories</h3>
     <div id="filelist" tabindex=1> 
     <ol id="filelist_ol" tabindex=2></ol>
     </div>
</div>
<div id="bottom_panel" class="ui-layout-south">
    <div id="buttons" ></div>
    <div id="bulk_edit_buttons"></div>
</div>
<div id="top_panel" class="ui-layout-north">
    <div id="statusline">Trajectory Editor</div>
    <div id="catalog">
        Drag onto editor below: 
        <span class="catalog-item vary-catalog-item ui-state-default" name="range" title="drag onto a loop below">+ range</span>
        <span class="catalog-item init-catalog-item vary-catalog-item ui-state-default" name="expression" title="drag onto a loop below">+ expression</span>
        <span class="catalog-item init-catalog-item ui-state-default" name="obj" title="drag onto a loop below">+ object</span>
        <span class="catalog-item init-catalog-item vary-catalog-item ui-state-default" name="list" title="drag onto a loop below">+ list</span>
        <span class="catalog-item init-catalog-item vary-catalog-item ui-state-default" name="counter" title="drag onto a loop below">+ counter</span>
        <span class="catalog-item vary-catalog-item ui-state-default" name="cycliclist" title="drag onto a loop below">+ cyclic list</span>
        <span class="catalog-item loops-catalog-item ui-state-default" name="loop" title="drag onto a loop below">+ vary</span>
        <span class="catalog-item loop-catalog-item main-catalog-item ui-state-default" name="subloop" title="drag onto a loop below">+ subloop</span>
    </div>
</div>
 
<div id="editor" class="ui-layout-center">
</div>

</body>
</html>
