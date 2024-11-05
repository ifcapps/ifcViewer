var lastLoadedTreeviewGUID;
var buttonLoadNextAdded = false;

function initializeTreeview(){
    loadHummingbird();
    m_splitterMain.div = $("#splitterMainDiv");
    m_splitterMain.div.on("mousedown", function(e) {
        m_splitterMain.isDown = true;
        var boundingRect = m_splitterMain.div.get(0).getBoundingClientRect();
        m_splitterMain.offset = [boundingRect.left - e.pageX, boundingRect.top - e.pageY];
    });

	splitterTreeview.div = $("#splitterTreeviewDiv");
	splitterTreeview.div.on( "mousedown", function(e) {
		splitterTreeview.isDown = true;
		var boundingRect=splitterTreeview.div.get(0).getBoundingClientRect();
		splitterTreeview.offset = [boundingRect.left - e.pageX, boundingRect.top - e.pageY];
	});
}

function setObjectSelectedByGUID(guid, trigger){
    if( m_keydown != 17 ){
        unselectAll();
    }
	guid = guid.substring(0, 22);
    if( isSelected(guid)) {return false;}

    if( guid == '' ){
        return;
    }
    
    try{
        var object3D = getObject3DbyGUID( guid );
        var treeviewItem = getTreeViewItemByGUID(guid,object3D);
        if( treeviewItem ){
            if( trigger == "3DView"){
                var guid_current_item_or_parent = guid;
                $("#treeview").hummingbird("expandNode",{attr:"id",name: guid_current_item_or_parent,expandParents:true});
                $("#treeview").hummingbird("checkNode",{sel:"id", vals:[guid]});
            }

            var treeviewItemElements=getTreeviewItemElements(treeviewItem);
            if(treeviewItemElements.labelElement){
                treeviewItemElements.labelElement.css({ 'background-color' : '' });
            }
            if(treeviewItemElements.liElement){
                treeviewItemElements.liElement.addClass("treeviewItemSelected"); // add class to li
            }

			if( trigger == "3DView"){
            	scrollToView( treeviewItem );
			}
            showDetailsOfObject(guid,treeviewItem);
        }
    
        // guid may be escaped if it comes from the treeview, where $ is not allowed as id
        guid = unescapeGUID(guid);

        if($.inArray(guid, m_selectedObjectsGUID) === -1) {
            if( typeof guid != "string" ){
                console.log("guid != string ");
                return;
            }
            if(guid.length<18){
                return;
            }
            m_selectedObjectsGUID.push(guid);
        }
        
        var objectsInSmallViewer = [];
        
        if( object3D ){
            object3D.selected = true;

            if( trigger == "treeview"){
                restoreMesh( object3D );
                var objectClone = object3D.clone();
                m_smallViewer.addToModelNode( objectClone );
                objectsInSmallViewer.push(objectClone);
            }

            setMeshSelected(object3D );
        }

        if( objectsInSmallViewer.length > 0 ){
            var w = window.innerWidth*0.3;
            var h = window.innerHeight*0.25;
            m_smallViewer.show();
            m_smallViewer.domElement.style.width = w + "px";
            m_smallViewer.domElement.style.height = h + "px";
            m_smallViewer.domElement.style.top = (window.innerHeight*0.75 - 30) + "px";
            m_smallViewer.domElement.style.left = "0px";
            m_smallViewer.camera.aspect = w / h;
            m_smallViewer.camera.updateProjectionMatrix();
            m_smallViewer.renderer.setSize( w, h );

            var box = new THREE.Box3();
            box.setFromObject( objectsInSmallViewer[0] );
            for( var ii = 1; ii < objectsInSmallViewer.length; ++ii ){
                const box2 = new THREE.Box3();
                box2.setFromObject( objectsInSmallViewer[ii] );
                if( box2.min.x < box.min.x ) box.min.x = box2.min.x;
                if( box2.min.y < box.min.y ) box.min.y = box2.min.y;
                if( box2.min.z < box.min.z ) box.min.z = box2.min.z;
                if( box2.max.x > box.max.x ) box.max.x = box2.max.x;
                if( box2.max.y > box.max.y ) box.max.y = box2.max.y;
                if( box2.max.z > box.max.z ) box.max.z = box2.max.z;
            }

            const center = box.getCenter( new THREE.Vector3() );
            var geometry = new THREE.BoxGeometry( box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z );
            geometry.translate(center.x, center.y, center.z);
            const edges = new THREE.EdgesGeometry( geometry );
            
            const line = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0x33ff33 } ) );
            m_smallViewer.rootNode.add( line );

             
            var geometry2 = new THREE.BoxGeometry( box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z );
            geometry2.translate(center.x, center.y, center.z);
            const edges2 = new THREE.EdgesGeometry( geometry2 );
            var lineMaterial = new THREE.LineBasicMaterial( { color: 0x33ff33, depthTest: false, transparent: true } );
            const line2 = new THREE.LineSegments( edges2, lineMaterial );
            line2.guid = guid;
            m_mainViewer.addToTempNode( line2 );
            
            m_smallViewer.controls.zoomToBoundsInitialAbove(box, false);
            m_smallViewer.controls.setRotateCenter( center );
            m_smallViewer.updateLightPositions(box);
        }
    }
    catch(error){
        console.log(error);
    }
    return true;
}


function getTreeViewItemByGUID(guid, object3D){
	if( typeof guid != "string" ){
		return;
	}
	var guid_escaped = guid;
	guid_escaped = escapeGUID(guid);
	
	var treeviewItem;
	try{
		treeviewItem = $("#treeview").find("#" + guid_escaped );

		if( treeviewItem.length == 0){

			// guid could belong to a geometric item which is part of an IfcProduct.
			// try to find next higher item, for example IfcWindow item
			if( object3D){
				if( object3D.parent ){
					var parentGUID = object3D.parent.name;
					guid_escaped = escapeGUID(parentGUID);
					treeviewItem = $("#treeview").find("#" +guid_escaped );

					if( treeviewItem.length > 0){
						return treeviewItem;
					}
				}
			}
		}
	}catch(error){
		console.log(error);
	}
	return treeviewItem;			
}

function scrollToView(element){
	if( !element ){
		return;
	}
	var html_ele = element.get(0);
	if( !html_ele )
	{
		return;
	}
	
	if( html_ele.offsetTop){

		var offset = html_ele.offsetTop;
		var pos = element.position();
		if( html_ele.scrollIntoView ){
			
			if( pos.top < 0 ){
				html_ele.scrollIntoView({behavior: "smooth", block: "start", inline: "nearest"});
			}
			else if(  pos.top > window.innerHeight){
				html_ele.scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
			}
			return;
		}
	}
	return true;
}

function escapeGUID(guid){
	if( typeof guid != "string" ){
		return;
	}
	if( guid.indexOf("$")  != -1 ){
		var escaped_guid = guid.replaceAll("$","");
		if( !m_escaped_guid2guid.hasOwnProperty(escaped_guid) ){
			m_escaped_guid2guid[escaped_guid] = guid;
		}
		return escaped_guid;
	}
	return guid;
}
function unescapeGUID(guid){
	if( m_escaped_guid2guid.hasOwnProperty(guid) ){
		guid = m_escaped_guid2guid[guid];
	}
	return guid;
}

function listProperties(propertiesArray, propertiesMap, treeviewContent, indentCount){
	if (propertiesArray == undefined) { return; }
	
	var hyphenString = "";
	for (var ii = 0; ii < indentCount; ++ii) { hyphenString += "-"; }
	for (var ii = 0; ii < propertiesArray.length; ++ii){
		var propertyIndex=propertiesArray[ii];
		var prop=propertiesMap[propertyIndex];
		if(prop==undefined){
			continue;
		}
		var propertyLabel=prop.value;
		if(prop.value==undefined){
			propertyLabel=prop.valueType;
		}
		
		treeviewContent.contentString += '<li id="p' + treeviewContent.liCount + '">' + hyphenString + prop.name + ":\t" + propertyLabel + "</li>";
		++treeviewContent.liCount;

		if (prop.properties) {  // complex property
			indentCount += 1;
			listProperties(prop.properties, propertiesMap, treeviewContent, indentCount);
			indentCount -= 1;
		}
	}
}

function showDetailsOfObject(guid_escaped){
	var guid=unescapeGUID(guid_escaped);
	var clickedNodeInfo = '';
	var object3D = getObject3DbyGUID( guid );
	if( object3D){
		if( object3D.userData){
			//clickedNodeInfo = 'Name: "' + object3D.userData.name;
		}
	}
	//clickedNodeInfo += '", GUID: ' + guid
	$('#statusbar1').html("  " + clickedNodeInfo);
	$('#statusbar2').html("");

	if(!(guid in metaObjectMap)){
		return;
	}

	var treeviewContent = { contentString: "", liCount: 0 };
	var selectedMetaObject=metaObjectMap[guid];
	if(!selectedMetaObject){
		treeviewContent.contentString += '<li id="' + guid + '_details">' + hyphenString + "GUID: " + guid + "</li>";
	}
	else{
		var hyphenString="";
		
		treeviewContent.contentString += '<li id="' + guid + '_details">' + hyphenString + "Name: " + selectedMetaObject.name + "</li>";
		treeviewContent.contentString += '<li id="' + guid + '_details_1">' + hyphenString + "Type: " + selectedMetaObject.type + "</li>";
		treeviewContent.contentString += '<li id="' + guid + '_details_2">' + hyphenString + "GUID: " + guid + "</li>";
		
		var propertiesMap = metadata.properties;
		if (propertiesMap) {
			if (propertySetMap.length == 0) {
				for (var i = 0; i < metadata.propertySets.length; ++i) {
					var propertySet = metadata.propertySets[i];
					propertySetMap[propertySet.id] = propertySet;
				}
			}

			if (selectedMetaObject.propertySetIds) {
				if (selectedMetaObject.propertySetIds.length > 0) {
					treeviewContent.contentString += '<li id="' + guid + '_psets">' + hyphenString + "PropertySets:</li>";

					for (var ii = 0; ii < selectedMetaObject.propertySetIds.length; ++ii) {
						hyphenString = "";
						var propertySetIndex = selectedMetaObject.propertySetIds[ii];
						var pset = propertySetMap[propertySetIndex];

						treeviewContent.contentString += '<li id="' + pset.id + '">' + hyphenString + pset.name + ", GUID(" + pset.id + ")</li>";

						var indentCount = 1;
						listProperties(pset.properties, propertiesMap, treeviewContent, indentCount);

					}
				}
			}
		}
	}

	$("#treeviewAttributes").html('<div id="treeview2" class="hummingbird-treeview-converter"></div>').ready(function () {

		$("#treeview2").html(treeviewContent.contentString).ready(function () {

			// disabled checkboxes
			$.fn.hummingbird.defaults.checkboxes ="disabled";
			// Set this to "disabled" to disable all checkboxes from nodes that are parents
			//$.fn.hummingbird.defaults.checkboxesGroups="disabled";
			//$.fn.hummingbird.defaults.checkboxesEndNodes="disabled";
			$.fn.hummingbird.defaults.collapseAll=false;
			$.fn.runHummingBirdConverter($("#treeview2"), 2);

			$("#treeview2").hummingbird();
			//$("#treeview2").hummingbird("expandAll");
			//$.fn.hummingbird.defaults.options.checkboxes=true;
			$.fn.hummingbird.defaults.checkboxes ="enabled";
			//$.fn.hummingbird.defaults.checkboxesGroups ="enabled";
			//$.fn.hummingbird.defaults.checkboxesEndNodes="enabled";

			var ulObjectJquery=$('#treeview_container2').children('ul').first();
			if(ulObjectJquery){
				var ulObject=ulObjectJquery.get(0);
				ulObject.style.marginLeft = "0px";
				ulObject.style.paddingInlineStart = "8px";
			}

			$("#treeview2").children('ul').children('li').children('label').css({"cursor":"pointer"})
		});
	});
}


function unselectTreeviewItems(){
	m_selectedObjectsGUID.forEach((guid) => {
		var treeviewItem=getTreeViewItemByGUID(guid);
		var treeviewItemElements=getTreeviewItemElements(treeviewItem);
		if(treeviewItemElements.inputElement){

		}
		if(treeviewItemElements.labelElement){
			treeviewItemElements.labelElement.removeClass("treeviewItemSelected");  // remove from label
		}
		if(treeviewItemElements.liElement){
			treeviewItemElements.liElement.removeClass("treeviewItemSelected");  // remove from li
		}
	});
	m_selectedObjectsGUID = [];
}

function unsnapTreeviewItems(){
	var treeviewItem=getTreeViewItemByGUID(m_snappedGUID);
	if (treeviewItem) {

		var treeviewItemElements=getTreeviewItemElements(treeviewItem);
		if(treeviewItemElements.inputElement){
			//treeviewItemElements.inputElement.removeClass("treeviewItemSnapped");  // remove from input
		}
		if(treeviewItemElements.labelElement){
			treeviewItemElements.labelElement.removeClass("treeviewItemSnapped");  // remove from label
		}
		if(treeviewItemElements.liElement){
			treeviewItemElements.liElement.removeClass("treeviewItemSnapped");  // remove from li
		}
	}
}

function isSelected( guid ){
	if( typeof guid == "string"){
		if( m_selectedObjectsGUID.includes(guid) ){
			return true;
		}
		guid = escapeGUID(guid);
		if( m_selectedObjectsGUID.includes(guid) ){
			return true;
		}
		guid = unescapeGUID(guid);
		if( m_selectedObjectsGUID.includes(guid) ){
			return true;
		}
	}
	return false;
}

function unsnapObject(){
	if( m_snappedGUID ){
		if( isSelected( m_snappedGUID )){
			return;
		}

		var object3D = getObject3DbyGUID( m_snappedGUID );
		if( object3D ){
			restoreMesh(object3D);
		}

		unsnapTreeviewItems();
	}
	m_snappedGUID = null;
}

function getTreeviewItemElements(inputItem){
	var treeviewItems ={};
	if(!inputItem){
		return;
	}
	
	treeviewItems.inputElement=null;
	treeviewItems.liElement=null;
	treeviewItems.labelElement=null;
	treeviewItems.iElement=null;
	if( inputItem.is("li") ){
		treeviewItems.liElement=inputItem;
		treeviewItems.inputElement=inputItem.find("input");
		treeviewItems.labelElement=inputItem.find("label");
		treeviewItems.iElement=inputItem.find("i");
	}
	else if( inputItem.is("label") ){
		treeviewItems.labelElement=inputItem;
		treeviewItems.inputElement=inputItem.find("input");
		// parent is li
		if( treeviewItems.labelElement.parent().is("li") ){
			treeviewItems.liElement=treeviewItems.labelElement.parent();
			treeviewItems.iElement=treeviewItems.liElement.find("i");
		}
	}
	else if( inputItem.is("i") ){
		treeviewItems.iElement=inputItem;
		// parent is li
		if( inputItem.parent().is("li") ){
			treeviewItems.liElement=inputItem.parent();
			treeviewItems.inputElement=treeviewItems.liElement.find("input");
			treeviewItems.labelElement=treeviewItems.liElement.find("label");
		}
	}
	else if( inputItem.is("input") ){
		treeviewItems.inputElement=inputItem;
		var parentItemJquery=inputItem.parent();
		var checkID =inputItem.get(0).id;
		var parentType=parentItemJquery.get(0).tagName;
		if( parentItemJquery.is("label") ){
			treeviewItems.labelElement = parentItemJquery;
			if( treeviewItems.labelElement.parent().is("li") ){
				treeviewItems.liElement=treeviewItems.labelElement.parent();
				treeviewItems.iElement=treeviewItems.liElement.find("i");
			}
		}
	}
	return treeviewItems;
}


function loadBuildingStructureTreeView(){
    if (!m_hasTreeview) { return; }
    if (metadata == null) { return; }
    $('#statushint').html('');

    if (metadata.metaObjects != null) {
        metadata.metaObjects.forEach((metaObject) => {
            if (metaObject.id != null) {
                metaObjectMap[metaObject.id] = metaObject;
                metaObject.text = metaObject.name;
            }
        });

        for (const [key, metaObject] of Object.entries(metaObjectMap)) {
            if (metaObject.parent == null) {
                metaObjectsRoot = metaObject;
                continue;
            }
            var metaObjectParent = metaObjectMap[metaObject.parent];
            if (metaObjectParent != null) {
                if (metaObjectParent.children == null) {
                    metaObjectParent.children = [];
                }
                metaObjectParent.children.push(metaObject);
            }
        }

        if (metaObjectsRoot) {
            var ulInTreeViewCount = 0;
            var treeviewContent = { contentString: "" };
            var guidsLoaded = new Set();
            loadTreeViewFromMetadata(metaObjectsRoot, treeviewContent, 0, guidsLoaded);

			$("#treeviewBuildingStructure").html('<div id="treeview" class="hummingbird-treeview-converter"></div>').ready(function () {

				$("#treeview").html(treeviewContent.contentString).ready(function () {
					var treeviewDiv = $("#treeview");
					$.fn.runHummingBirdConverter(treeviewDiv, 1);

					// Resetting defaults if necessary
					$.fn.hummingbird.defaults.SymbolPrefix= "";  
					$.fn.hummingbird.defaults.collapsedSymbol = "fa-angle-right";
					$.fn.hummingbird.defaults.expandedSymbol = "fa-angle-down";
					$.fn.hummingbird.defaults.hoverColorBg1="";

					$("#treeview").hummingbird();
					$("#treeview").hummingbird("expandAll");
					$("#treeview").hummingbird("checkAll");

					$("#treeview").on("nodeChecked", function(){
						console.log("checked")
					});

					$("#treeview").on("nodeUnchecked", function(){
						console.log("unchecked");
					});

					$("#treeview").on("CheckUncheckDone", function(){
						console.log("CheckUncheckDone");
					});

					$(document).on("tap click", 'label', function( event, data ){
						var clickedElement = $(event.target);
						if(clickedElement.is("input")){
							return true;
						}
						if(clickedElement.is("i")){
							return true;
						}
						event.stopPropagation();
						event.preventDefault();
						console.log("click on label default override")
						return false;
					});

					fixTreeviewEndNodeMargin();

					if (expandItemGUID != '') {
						//$("#treeview").hummingbird("expandNode",{attr:"id",name: expandItemGUID,expandParents:true});
					}

					$('#statushint').html('');
				});
			});
        }
    }

    $('#debug').html(m_numModelItems + ' ' + 'elements loaded');
}

function fixTreeviewEndNodeMargin(){
	$("input.hummingbird-end-node:checkbox").each(function(){
		$( this ).get(0).style.marginLeft = "18px";
	});
}

function loadNextTreeviewItems(buttonLoadNext){
	m_maxNumTreeviewItems = 2*m_maxNumTreeviewItems;
	buttonLoadNextAdded = false;
	m_numTreeviewItems = 0;
	$('#statushint').html( '' );
	loadBuildingStructureTreeView();
	$('#statushint').html('');
}



function loadTreeViewFromMetadata(metaObject, treeviewContent, levelCount, guidsLoaded) {

	var guid = metaObject.id;
	var guid_escaped = escapeGUID(guid);

	if (guidsLoaded.has(guid)){
		guid = guid + "_" + levelCount;
	}
	guidsLoaded.add(guid);
	
	var itemLabel = '';
	if (metaObject.name){
		itemLabel = metaObject.name;
	}
	if(itemLabel==''||itemLabel==' '){
		if (metaObject.type) {
			itemLabel = metaObject.type;
		}
		if(!m_guidInTreeviewLabel){
			itemLabel += " " + metaObject.id;
		}
	}
	if(m_guidInTreeviewLabel){
		itemLabel += " " + metaObject.id;
	}

	if(levelCount>7){
		return;
	}

	++m_numModelItems;

	if (m_numTreeviewItems >= m_maxNumTreeviewItems){
		if (!buttonLoadNextAdded) {
			var buttonLoadMore = $('<input type="button" id="' + guid_escaped + '" onclick="loadNextTreeviewItems(this);" value="Load more"/>');
			$("#treeviewPanel").append(buttonLoadMore);
			buttonLoadNextAdded = true;
			return;
		}

		// just for counting:
		if (metaObject.children) {
			for (var i = 0; i < metaObject.children.length; ++i) {
				const child = metaObject.children[i];
				
			}
		}
		return;
	}

	var hyphenString = "";
	for (var i = 0; i < levelCount; ++i) { hyphenString += "-" }
	treeviewContent.contentString += '<li id="' + guid_escaped + '">' + hyphenString + itemLabel + "</li>";

	++m_numTreeviewItems;
	lastLoadedTreeviewGUID = guid;

	if (m_numModelItems % 50 == 0) {
		$('#debug').html(m_numModelItems + ' elements loaded');
	}

	var tooltip = '';
	if (itemLabel.length > 30) {
		tooltip = ' title="' + itemLabel + '"';
	}

	var has_children = false;
	if (metaObject.children) {
		for (var i = 0; i < metaObject.children.length; ++i) {
			const child = metaObject.children[i];
			if (child) {
				has_children = true;
				break;
			}
		}
	}

	if (levelCount == expandLevelTop) {
		//if (expandItemGUID == '') { }
		expandItemGUID = guid_escaped;
		expandLevelTop = levelCount;
	}
	else if (levelCount > 0 && expandItemGUID == "") {
		expandItemGUID = guid_escaped;
		expandLevelTop = levelCount;
	}

	if (has_children) {

		if (metaObject.children) {
			var childLevelCount=levelCount + 1;
			for (var i = 0; i < metaObject.children.length; ++i) {
				const child = metaObject.children[i];
				loadTreeViewFromMetadata(child, treeviewContent, childLevelCount, guidsLoaded);
			}
		}
	}
}


function clearTreeView(){
	$("#treeview").hummingbird('destroy'); // If there's a destroy method for cleanup
    $("#treeview").empty();
    $("#treeview2").hummingbird('destroy');
    $("#treeview2").empty();
}
