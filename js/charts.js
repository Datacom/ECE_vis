var resetTabCharts  
var _data = [];
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _title_text = {};
var small_chart_height = 200;

var donut_inner = 43
var donut_outer = 70
var donut_height = 170

var valueAccessor =function(d){return d.value < 1 ? 0 : d.value}

var getkeys;
//---------------------CLEANUP functions-------------------------

function cleanup(d) {
  
  for(i in d){ 
   if (+i){
      var record = {
                council: d['Regional Council11'].replace("Hawkes","Hawke's"),
                service: d['Service type4'],
                ethnicity: d['Ethnic group9'],	
                age: d['Age of child7'],
                year: +i
               }
      if (+d[i] > 0){
        record.count =  +d[i] //? +d[i] : 0  
        _data.push(record)
        }
      }
    }
}

//---------------------------crossfilter reduce functions---------------------------

// we only use the built in reduceSum(<what we are summing>) here

//----------------------------Accessor functions-------------------------------------

// because we are only using default reduce functions, we don't need any accessor functions either 

//-------------------------Load data and dictionaries ------------------------------

//Here queue makes sure we have all the data from all the sources loaded before we try and do anything with it. It also means we don't need to nest D3 file reading loops, which could be annoying. 

queue()
    .defer(d3.csv,  "data/Enrolments in ECE by region.csv")
    .defer(d3.csv,  "dictionaries/Region_dict.csv")
    .defer(d3.csv,  "dictionaries/titles.csv")
    .defer(d3.json, "gis/region_boundaries_singlepart_simp_p001.geojson")
    .await(showCharts);

function showCharts(err, data, region_dict, title_text, region_bounds) {

//We use dictionary .csv's to store things we might want to map our data to, such as codes to names, names to abbreviations etc.
  
//titles.csv is a special case of this, allowing for the mapping of text for legends and titles on to the same HTML anchors as the charts. This allows clients to update their own legends and titles by editing the csv rather than monkeying around in the .html or paying us to monkey around with the same.    
  
  var councilNames = [];
  
  for (i in title_text){
        entry = title_text[i]
        //trimAll(entry)
        name = entry.id
        _title_text[name]=entry;     
  }

    for (i in region_dict) {
    entry = region_dict[i]
    trimAll(entry)
    name = entry.Map_region
    _region_dict[name]=entry;
  }
  
  for (i in data) {
    cleanup(data[i]);
  }
  //_data = data;
 
  _region_bounds = region_bounds;    

//------------Puts legends and titles on the chart divs and the entire page---------------   
  apply_text(_title_text)

//---------------------------------FILTERS-----------------------------------------
  ndx = crossfilter(_data); // YAY CROSSFILTER! Unless things get really complicated, this is the only bit where we call crossfilter directly. 

  
//---------------------------ORDINARY CHARTS --------------------------------------
     
  year = ndx.dimension(function(d) {return d.year});
  year_group = year.group().reduceSum(function(d){return d.count});
 
  year_chart = dc.barChart('#year')
    .dimension(year)
    .group(year_group)
    .valueAccessor(valueAccessor)
    .x(d3.scale.linear().domain([1999,2015]))
    //.xUnits() will often look something like ".xUnits(dc.units.fp.precision(<width of bar>))", but here is 1, so we dont need to bother.
    .transitionDuration(200)
    .height(150)
    .colors(default_colors)
    .elasticX(false)
    .elasticY(true)
    .centerBar(true)
    
  year_chart.xAxis().ticks(4).tickFormat(d3.format('d'));
  year_chart.yAxis().ticks(4).tickFormat(integer_format)

  ethnicity = ndx.dimension(function(d) {return d.ethnicity});
  ethnicity_group = ethnicity.group().reduceSum(function(d){return d.count});
 
  ethnicity_chart = dc.rowChart('#ethnicity')
    .dimension(ethnicity)
    .group(ethnicity_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})

  ethnicity_chart.xAxis().ticks(4).tickFormat(integer_format)
  ethnicity_chart.on('pretransition.dim', grey_zero)
  
  age = ndx.dimension(function(d) {return d.age});
  age_group = age.group().reduceSum(function(d){return d.count});
 
  age_chart = dc.rowChart('#age')
    .dimension(age)
    .group(age_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return d.key[4]})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  age_chart.xAxis().ticks(4).tickFormat(integer_format);
  age_chart.on('pretransition.dim',grey_zero) 
  
  service = ndx.dimension(function(d) {return d.service});
  service_group = service.group().reduceSum(function(d){return d.count});
 
  service_chart = dc.rowChart('#service')
    .dimension(service)
    .group(service_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  service_chart.xAxis().ticks(4).tickFormat(integer_format);
  service_chart.on('pretransition.dim', grey_zero) 
  
  
////----------------------------Map functions----------------------------------

  function zoomed() {
    projection
    .translate(d3.event.translate)
    .scale(d3.event.scale);
    var hidden = projection.scale() == 1600 && JSON.stringify(projection.translate()) == JSON.stringify([220,320]);
    d3.select('#resetPosition').classed('hidden',function(){return hidden})
    region_map.render();
    }
  
  zoom = d3.behavior.zoom()
    .translate(projection.translate())
    .scale(projection.scale())
    .scaleExtent([1600, 20000])
    .on("zoom", zoomed);

  
////------------------Map Regions
  
  region = ndx.dimension(function(d) { return d['council']});
  region_group = region.group().reduceSum(function(d){return d.count})
  
  d3.select("#region_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(region_map.data(), region_map.valueAccessor());
    ext[0]=0.0001;
    region_map.colorDomain(ext);
  }

  map_width = d3.select("#region_map").select('legend').node().getBoundingClientRect().width

  region_map = dc.geoChoroplethChart("#region_map")
      .dimension(region)
      .group(region_group)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .width(map_width-10)
      .overlayGeoJson(_region_bounds.features, 'Region', function(d) {return d.properties.REGC2013_N.replace(' Region', '')})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_integer_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
   
  dc.renderAll()
 
}
