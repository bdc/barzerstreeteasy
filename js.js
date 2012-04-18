var originalquery = '';

var url = {
	static : {
		rentals : 'http://streeteasy.com/nyc/rentals/',
		sales   : 'http://streeteasy.com/nyc/sales/',
		keyword : 'http://streeteasy.com/nyc/search?search=',
	},
	base : "",
	attrs: {},
	addattr : function(attr, valarray, joinsymbol) {
		if(valarray.length === 0 || (valarray.length === 1 && valarray[0] === "")) return;
		// special case for rental/sales determination
		if(attr === 'status' && valarray[0] === 'sales')
			this.setbaseurlsales();
		else if(attr === 'status' && valarray[0] === 'rentals')
			this.setbaseurlrentals();
		else if(attr === 'status' && valarray[0] === 'open')
			this.attrs['status'] = ':open';
		else
		{
			this.attrs[attr] = (joinsymbol ? joinsymbol : ':') + valarray.join(',');
			this.attrs['notempty'] = 1;
		}
		if(this.base === "" && attr === "price") // best guess as to sales/rental
			parseInt(valarray[1]) < 100000 ? this.setbaseurlrentals() : this.setbaseurlsales();
	},
	reset : function() {
		this.base = "";
		this.attrs = {};
	},
	setbaseurlrentals : function() {
		this.addattr('status', ['open']);
		this.base = this.static.rentals;
	},
	setbaseurlsales : function() {
		this.addattr('status', ['open']);
		this.base = this.static.sales;
	},
	setbaseurlkeywordsearch : function() {
		this.base = this.static.keyword;
	},
	tostr : function() {
		// if no attrs, default to boring keyword search
		if(!this.attrs.hasOwnProperty('notempty'))
			return url.static.keyword + originalquery;
		// resolve base, if not exist
		if(this.base === "")
			this.setbaseurlrentals();
		tempurl = this.base;
		for(var attr in this.attrs)
			if(this.attrs.hasOwnProperty(attr) && attr !== 'notempty')
				tempurl += '|' + attr + this.attrs[attr];
		return tempurl;
	},
};


function setstatus(text)
{
	document.getElementById("statustext").innerHTML = text;
}


function formatnumber(number, maxdecplaces)
{
	if(!maxdecplaces)
		return (new Number(number)).toFixed(0);
	if(maxdecplaces > 0 && number == Math.round(number))
		return (new Number(number)).toFixed(0);
	return (new Number(number)).toFixed(maxdecplaces);
}


function barz(query)
{
	setstatus("Sending request to Barzer engine...");
	// send request
	var xhr = new XMLHttpRequest();
	originalquery = query;
	xhr.open("GET", "dorequest.php?query="+query);
	xhr.onreadystatechange=function(){
		if(xhr.readyState === 4){
			parseresponse(eval('(' + xhr.responseText + ')'));
		};
	};
	xhr.send();
}


function parseresponse(rsp)
{
	setstatus("Parsing response...");
	// parse response
	if(rsp.result !== "OK")
	{
		setstatus("Something terrible has happened.");
		exit;
	}

	url.reset();

	if(rsp.prices.length !== 0)
	{
		lo = rsp.prices[0][0]["lo"];
		hi = rsp.prices[0][0]["hi"];
		if(lo === "") lo = 0;
		if(hi === "") hi = 1000000000;
		url.addattr('price', [formatnumber(lo) + "-" + formatnumber(hi)]);
	}

	for(i = 0; i < rsp.erc.length; i++)
	{
		erctype = /^(.*?):/.exec(rsp.erc[i][0].entity)[1];
		if(erctype === "bedroom") // integer range
		{
			lo = rsp.erc[i][0].range.lo;
			hi = rsp.erc[i][0].range.hi;
			if(lo === hi)
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo)]);
			else if(hi >= 100)
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo)], '>=');
			else
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo) + "-" + formatnumber(hi)]);
		}
		if(erctype === "bathroom") // float range
		{
			lo = rsp.erc[i][0].range.lo;
			hi = rsp.erc[i][0].range.hi;
			if(lo === hi)
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo, 1)]);
			else if(hi >= 100)
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo, 1)], '>=');
			else
				url.addattr(barzerstreeteasyentitymapping(erctype), [formatnumber(lo, 1) + "-" + formatnumber(hi, 1)]);
		}
	}

	for(i = 0; i < rsp.entities.length; i++)
	{
		if(typeof(rsp.entities[i][0]) === "string")
		{
			if(em = /^((.*?)\..*?):/.exec(rsp.entities[i][0]))
			{	// entity with a category
				entitycategory = em[2];
				entityname     = em[1];
				url.addattr(entitycategory, [barzerstreeteasyentitymapping(entityname)]);
			}
			else if(em = /^(.*?)\-(\d+):/.exec(rsp.entities[i][0]))
			{	// location
				locid = barzerstreeteasylocationmapping(em[2]);
				url.addattr('area', [locid]);
			}
		}
		else if(typeof(rsp.entities[i][0]) === "object")
		{
			entitynames = [];
			for(j = 0; j < rsp.entities[i][0].length; j++)
			{
				if(em = /^((.*?)\..*?):/.exec(rsp.entities[i][0][j]))
				{
					entitycategory = em[2];
					entityname	 = em[1];
					entitynames[j] = barzerstreeteasyentitymapping(entityname);
				}
				else if(em = /^(.*?\-)(\d+):/.exec(rsp.entities[i][0][j]))
				{	// location
					entitycategory = 'area';
					entitynames[j] = barzerstreeteasylocationmapping(em[2]);
				}
			}
			url.addattr(entitycategory, entitynames);
		}
	}

	setstatus("Results below. [<A class='resulturl' href='#' onclick='top.window.prompt(\"Barzer response\",\"" + JSON.stringify(rsp).replace(/([\\"'])/g, "\\$1").replace(/\0/g, "\\0") + "\")'>click to view Barzer response</A>] [<A class='resulturl' href='#' onclick='top.window.prompt(\"Result\",\"" + url.tostr() + "\")'>click to view resulting url</A>] ");

	// load get in other frame
	parent.streeteasyframe.location.href = url.tostr();
}


function barzerstreeteasyentitymapping(barzerentity)
{
	barzerstreeteasyentitymap = {
	  'amenities.Gym' : 'gym',
	  'amenities.Loft' : 'loft',
	  'amenities.Fireplace' : 'fireplace',
	  'amenities.Pets' : 'pets',
	  'amenities.Storage' : 'storage',
	  'amenities.LeedRegistered' : 'leed_registered',
	  'amenities.Pool' : 'pool',
	  'amenities.PiedATierre' : 'pied_a_terre',
	  'amenities.Dishwasher' : 'dishwasher',
	  'amenities.Laundry' : 'laundry',
	  'amenities.Furnished' : 'furnished',
	  'amenities.Loft' : 'loft',
	  'amenities.Fireplace' : 'fireplace',
	  'amenities.Pets' : 'pets',
	  'amenities.Pool' : 'pool',
	  'amenities.Garage' : 'garage',
	  'amenities.OutdoorSpace' : 'outdoor_space',
	  'amenities.Doorman' : 'doorman',
	  'amenities.Washer' : 'washer_dryer',
	  'amenities.Elevator' : 'elevator',
	  'rental_type.frbo' : 'frbo',
	  'rental_type.brokernofee' : 'brokernofee',
	  'rental_type.brokerfee' : 'brokerfee',
	  'type.Condo' : 'D1',
	  'type.Coop' : 'P1',
	  'type.House' : 'X',
	  'type.Multi-family' : 'M',
	  'type.Timeshare' : 'Y',
	  'type.Land' : 'A',
	  'type.Apartment' : '', // probably wrong
	  'status.Sales' : 'sales',
	  'status.Rental' : 'rentals',
	  // entities which ARE categories
	  'bedroom' : 'beds',
	  'bathroom' : 'baths',
	};
	if(!barzerstreeteasyentitymap.hasOwnProperty(barzerentity))
		return '';
	return barzerstreeteasyentitymap[barzerentity];
}


function barzerstreeteasylocationmapping(barzerlocationid)
{
	barzerstreeteasylocationmap = {
	//	"RealtyMX"  : "StreetEasy", // Name
		"21"  : "102", // All Downtown
		"29"  : "144", // All Upper Manhattan
		"108" : "475", // Alley Park
		"256" : "507", // Annadale
		"257" : "508", // Arden Heights
		"258" : "509", // Arlington
		"259" : "510", // Arrochar
		"109" : "448", // Arverne
		"110" : "401", // Astoria
		"112" : "431", // Auburndale
		"54"  : "336", // Bath Beach
		"19"  : "112", // Battery Park City
		"55"  : "331", // Bay Ridge
		"113" : "511", // Bay Terrace
		"197" : "243", // Baychester
		"114" : "428", // Bayside
		"198" : "221", // Bedford Park
		"56"  : "310", // Bedford-Stuyvesant
		"115" : "461", // Beechhurst
		"117" : "463", // Belle Harbor
		"118" : "443", // Bellerose
		"199" : "218", // Belmont
		"57"  : "334", // Bensonhurst
		"58"  : "363", // Bergen Beach
		"261" : "512", // Bloomfield
		"59"  : "306", // Boerum Hill
		"60"  : "338", // Borough Park
		"120" : "458", // Bowne Park
		"121" : "464", // Breezy Point
		"122" : "446", // Briarwood
		"61"  : "342", // Brighton Beach
		"123" : "441", // Broad Channel
		"24"  : "200", // Bronx
		"5" : "300", // Brooklyn
		"62"  : "305", // Brooklyn Heights
		"124" : "479", // Brookville
		"63"  : "354", // Brownsville
		"262" : "514", // Bulls Head
		"64"  : "313", // Bushwick
		"263" : "515", // Butler Manor
		"125" : "437", // Cambria Heights
		"65"  : "359", // Canarsie
		"66"  : "321", // Carroll Gardens
		"201" : "229", // Castle Hill
		"264" : "516", // Castleton Corners
		"38"  : "154", // Central Harlem
		"265" : "517", // Charleston
		"7" : "115", // Chelsea
// commenting out for the demo		"266" : "518", // Chelsea (Staten Island)
		"15"  : "110", // Chinatown
		"202" : "236", // City Island
		"203" : "208", // Claremont
		"126" : "459", // Clearview
		"267" : "519", // Clifton
		"4" : "125", // Clinton
		"67"  : "364", // Clinton Hill
		"205" : "234", // Co-op City
		"68"  : "322", // Cobble Hill
		"127" : "418", // College Point
		"69"  : "328", // Columbia Street Waterfront District
		"268" : "521", // Concord
		"206" : "211", // Concourse
		"70"  : "341", // Coney Island
		"128" : "409", // Corona
		"208" : "273", // Country Club
		"71"  : "325", // Crown Heights
		"190" : "474", // Ditmars-Steinway
		"72"  : "343", // Ditmas Park
		"269" : "522", // Dongan Hills
		"129" : "429", // Douglaston
		"73"  : "303", // Downtown Brooklyn
		"74"  : "307", // DUMBO
		"75"  : "332", // Dyker Heights
		"130" : "406", // East Elmhurst
		"40"  : "155", // East Harlem
		"77"  : "314", // East New York
		"209" : "216", // East Tremont
		"17"  : "117", // East Village
		"210" : "246", // Eastchester
		"131" : "466", // Edgemere
		"270" : "524", // Elm Park
		"132" : "408", // Elmhurst
		"271" : "525", // Eltingville
		"272" : "526", // Emerson Hill
		"133" : "440", // Far Rockaway
		"212" : "227", // Fieldston
		"247" : "104", // Financial District
		"79"  : "346", // Flatbush
		"10"  : "158", // Flatiron
		"80"  : "360", // Flatlands
		"134" : "442", // Floral Park
		"135" : "416", // Flushing
		"213" : "214", // Fordham
		"137" : "415", // Forest Hills
		"41"  : "151", // Fort George
		"81"  : "304", // Fort Greene
		"140" : "419", // Fresh Meadows
		"82"  : "370", // Gerritsen Beach
		"141" : "439", // Glen Oaks Village
		"142" : "413", // Glendale
		"83"  : "320", // Gowanus
		"13"  : "113", // Gramercy Park
		"273" : "528", // Graniteville
		"274" : "529", // Grant City
		"275" : "530", // Grasmere
		"84"  : "337", // Gravesend
		"276" : "531", // Great Kills
		"85"  : "301", // Greenpoint
		"277" : "532", // Greenridge
		"248" : "116", // Greenwich Village
		"11"  : "116", // Greenwich Village
		"86"  : "367", // Greenwood
		"278" : "533", // Grymes Hill
		"43"  : "148", // Hamilton Heights
		"143" : "473", // Hammels
		"279" : "535", // Heartland Village
		"214" : "210", // Highbridge
		"144" : "453", // Hillcrest
		"145" : "434", // Hollis
		"147" : "425", // Howard Beach
		"280" : "537", // Howland Hook
		"44"  : "145", // Hudson Heights
		"281" : "538", // Huguenot
		"148" : "478", // Hunters Point
		"215" : "204", // Hunts Point
		"30"  : "150", // Inwood
		"149" : "405", // Jackson Heights
		"150" : "432", // Jamaica
		"152" : "447", // Jamaica Estates
		"153" : "421", // Jamaica Hills
		"88"  : "340", // Kensington
		"154" : "424", // Kew Gardens
		"155" : "420", // Kew Gardens Hills
		"216" : "224", // Kingsbridge
		"251" : "133", // Kips Bay
		"156" : "436", // Laurelton
		"282" : "540", // Lighthouse Hill
		"158" : "470", // Lindenwood
		"249" : "108", // Little Italy
		"159" : "430", // Little Neck
		"160" : "402", // Long Island City
		"217" : "205", // Longwood
		"18"  : "109", // Lower East Side
		"161" : "460", // Malba
		"89"  : "350", // Manhattan Beach
		"46"  : "138", // Manhattan Valley
		"90"  : "335", // Mapleton
		"218" : "226", // Marble Hill
		"91"  : "361", // Marine Park
		"283" : "544", // Mariners Harbor
		"162" : "410", // Maspeth
		"219" : "202", // Melrose
		"163" : "411", // Middle Village
		"284" : "546", // Midland Beach
		"3" : "123", // Midtown East
		"4" : "124", // Midtown West
		"92"  : "348", // Midwood
		"93"  : "362", // Mill Basin
		"47"  : "147", // Morningside Heights
		"220" : "212", // Morris Heights
		"221" : "237", // Morris Park
		"222" : "207", // Morrisania
		"223" : "201", // Mott Haven
		"225" : "215", // Mt. Hope
		"164" : "130", // Murray Hill
		"165" : "465", // Neponsit
		"285" : "547", // New Brighton
		"286" : "548", // New Dorp
		"287" : "591", // New Dorp Beach
		"288" : "549", // New Springville
		"14"  : "118", // Noho
		"252" : "162", // Nolita
		"166" : "407", // North Corona
		"227" : "260", // Norwood
		"167" : "451", // Oakland Gardens
		"289" : "550", // Oakwood
		"168" : "471", // Old Howard Beach
		"290" : "552", // Old Town
		"169" : "426", // Ozone Park
		"291" : "553", // Park Hill
		"94"  : "319", // Park Slope
		"229" : "231", // Parkchester
		"230" : "233", // Pelham Bay
		"231" : "266", // Pelham Gardens
		"232" : "238", // Pelham Parkway
		"292" : "554", // Pleasant Plains
		"170" : "454", // Pomonok
		"293" : "555", // Port Ivory
		"233" : "203", // Port Morris
		"294" : "556", // Port Richmond
		"295" : "557", // Princes Bay
		"95"  : "326", // Prospect Heights
		"98"  : "329", // Prospect Lefferts Gardens
		"97"  : "355", // Prospect Park South
		"23"  : "400", // Queens
		"172" : "438", // Queens Village
		"173" : "476", // Queensboro Hill
		"296" : "559", // Randall Manor
		"99"  : "318", // Red Hook
		"175" : "414", // Rego Park
		"176" : "423", // Richmond Hill
		"298" : "560", // Richmond Valley
		"297" : "561", // Richmondtown
		"177" : "412", // Ridgewood
		"234" : "225", // Riverdale
		"179" : "452", // Rockaway Park
		"34"  : "101", // Roosevelt Island
		"299" : "562", // Rosebank
		"180" : "444", // Rosedale
		"300" : "563", // Rossville
		"304" : "569", // Saint George
		"235" : "274", // Schuylerville
		"100" : "345", // Seagate
		"101" : "349", // Sheepshead Bay
		"301" : "565", // Shore Acres
		"302" : "566", // Silver Lake
		"12"  : "107", // Soho
		"236" : "228", // Soundview
		"303" : "568", // South Beach
		"186" : "433", // South Jamaica
		"187" : "427", // South Ozone Park
		"189" : "445", // Springfield Gardens
		"237" : "249", // Spuyten Duyvil
		"182" : "435", // St. Albans
		"305" : "571", // Stapleton
		"306" : "572", // Stapleton Heights
		"25"  : "500", // Staten Island
		"16"  : "106", // Stuyvesant Town/PCV
		"191" : "403", // Sunnyside
		"308" : "573", // Sunnyside
		"102" : "323", // Sunset Park
		"238" : "232", // Throgs Neck
		"309" : "575", // Todt Hill
		"310" : "576", // Tompkinsville
		"311" : "577", // Tottenville
		"312" : "578", // Travis
		"9" : "105", // Tribeca
		"239" : "230", // Union Port
		"240" : "213", // University Heights
		"2" : "140", // Upper East Side
		"1" : "137", // Upper West Side
		"193" : "455", // Utopia
		"241" : "240", // Van Nest
		"103" : "308", // Vinegar Hill
		"242" : "245", // Wakefield
		"52"  : "149", // Washington Heights
		"313" : "580", // West Brighton
// commenting out for the demo		"7" : "163", // West Chelsea
		"243" : "219", // West Farms
		"53"  : "153", // West Harlem
		"8" : "157", // West Village
		"244" : "235", // Westchester Square
		"314" : "582", // Westerleigh
		"194" : "417", // Whitestone
		"245" : "242", // Williamsbridge
		"104" : "302", // Williamsburg
		"105" : "302", // Williamsburg
		"106" : "302", // Williamsburg
		"78"  : "302", // Williamsburg
		"107" : "324", // Windsor Terrace
		"195" : "422", // Woodhaven
		"246" : "244", // Woodlawn
		"315" : "584", // Woodrow
		"196" : "404", // Woodside
	};
	if(!barzerstreeteasylocationmap.hasOwnProperty(barzerlocationid))
		return "0";
	return barzerstreeteasylocationmap[barzerlocationid];
}


