'use strict'

var express   = require('express'),
  app         = express(),
  bodyParser  = require('body-parser'),
  cfenv       = require('cfenv'),
  watson      = require('watson-developer-cloud'),
  DiscoveryV1 = require('watson-developer-cloud/discovery/v1'),
  url         = require("url"),
  mysql       = require("mysql"),
  schedule    = require("node-schedule");

var dailyFurs="";

console.log("Iniciando Script index")
// Configure Express
// serve the files out of ./public as our main files
app.enable('trust proxy');

app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(__dirname + '/public'));

// Start listening for connections
app.listen(3000, function () {
  console.log('App listening on port 3000');
});

//Hace el PMT
var j=schedule.scheduleJob('30 * * * *',()=>{
  if(dailyFurs!=""){
    var temp = dailyFurs.substring(0, dailyFurs.length - 1 );
    temp = temp.split("$");
  for (var i = 0; i < temp.length; i++) {
    //en esta funcionse agregan los documentos de discovery a PMT
    addDocumentMySql(temp[i]);

  }
  //una vez que los fur del dia se bajan a Mysql, se borra la string
  dailyFurs="";
}
});


var connectionString = "mysql://admin:UUYDGRFYUVKUGCMK@sl-us-south-1-portal.22.dblayer.com:39980/compose"
var mysqlurl = new url.URL(connectionString);

var options = {
    host: mysqlurl.hostname,
    port: mysqlurl.port,
    user: mysqlurl.username,
    password: mysqlurl.password,
    database: mysqlurl.pathname.split("/")[1]
};

var discovery = new DiscoveryV1({
  username: 'c8dfa494-816b-4165-be31-470fffc14eaf',
  password:'0vsnVTXFxTXO',
  version: 'v1',
  version_date: '2017-11-07'
});


//Sacar los resultados de discovery, los pone en un arreglo y posteriormente pobla la base de datos con el arreglo previamente armando
function addDocumentMySql(fur){
  discovery.query({ environment_id: 'c2c97c85-777d-48ed-ba23-b49c525f1e30', collection_id: 'c249478e-251a-40f8-bfdf-57f725ee3d83',query:fur},
  function(error, data) {
    if(!error){
      console.log(data)
      var fullDocs=[]
      
      for (var i = 0; data.results[i]!=undefined; i++){

        if (data.results[i].enriched_text!=undefined) {
          var id   = data.results[i].id
          var fur  = data.results[i].fur
          var sentiment  = data.results[i].enriched_text.sentiment.document.label
          var entities   = {}

          if(data.results[i].enriched_text.entities != undefined && data.results[i].enriched_text.entities.length > 0){
              entities.bancos               = ""
              entities.indicador            = ""
              entities.porcentaje           = ""
              entities.tarjeta              = ""
              entities.palabraspositivas    = ""
              entities.palabrasnegativas    = ""
              entities.beneficios           = ""

              for (var j=0;data.results[i].enriched_text.entities[j]!=undefined;j++){
                if (data.results[i].enriched_text.entities[j].type=="Bancos")
                  entities.bancos += data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="Indicador")
                  entities.indicador+=data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="Porcentaje")
                  entities.porcentaje+=data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="Tarjeta")
                  entities.tarjeta+=data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="PalabrasPositivas")
                  entities.palabraspositivas+=data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="PalabrasNegativas")
                entities.palabraspositivas+=data.results[i].enriched_text.entities[j].text+",";
                if (data.results[i].enriched_text.entities[j].type=="Beneficios")
                entities.beneficios+=data.results[i].enriched_text.entities[j].text+",";
              }
          }

            if(data.results[i].enriched_text.entities != undefined && data.results[i].enriched_text.entities.length > 0){
              if(entities.bancos!="")
                entities.bancos = entities.bancos.substr(0,entities.bancos.length-1)
              if(entities.indicador!="")
                entities.indicador  = entities.indicador.substr(0,entities.indicador.length-1)
              if(entities.porcentaje!="")
                entities.porcentaje = entities.porcentaje.substr(0,entities.porcentaje.length-1)
              if(entities.tarjeta!="")
                entities.tarjeta    = entities.tarjeta.substr(0,entities.tarjeta.length-1)
              if(entities.palabraspositivas!="")
                entities.palabraspositivas = entities.palabraspositivas.substr(0,entities.palabraspositivas.length-1)
              if(entities.palabrasnegativas!="")
                entities.palabrasnegativas = entities.palabrasnegativas.substr(0,entities.palabrasnegativas.length-1)
              if(entities.beneficios!="")
              entities.beneficios = entities.beneficios.substr(0,entities.beneficios.length-1)
            }
          var doc = {}
          doc.id = id
          doc.fur=fur
          doc.sentiment=sentiment
          doc.entities=entities
          fullDocs.push(doc)
        }
      }

      //una vez que tenemos nuestro arreglo full docs poblado con los datos de discovery comenzamos a poblar la base de datos PMT
     
      //var connection = mysql.createConnection(options); ------Quitar comentario para que funcione correctamente---------

      var connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Mini123.',
        database: 'Prueba'
      });

      connection.connect(function(err) {
        if (err) {
                console.log(err);
        } 
        else {
            connection.query(
              "CREATE TABLE IF NOT EXISTS PMT(id varchar(50) primary key, fur varchar(256), sentiment varchar(256), bancos varchar(256), porcentaje varchar(256), tarjeta varchar(256), indicador varchar(256), palpos varchar(256), palneg varchar(256), beneficios varchar(256))",
              function(err, result) {
                  if (err) {
                      console.log(err);
                  }
              }
          );

          console.log("Antes de hacer la query")

          var queryText = "INSERT INTO PMT(id,fur,sentiment,bancos,porcentaje,tarjeta,indicador,palpos,palneg,beneficios) VALUES(?,?,?,?,?,?,?,?,?,?)";

          console.log(JSON.stringify(fullDocs));

          for(var i=0;i<fullDocs.length;i++){
            connection.query(
              queryText,[fullDocs[i].id,fullDocs[i].fur,fullDocs[i].sentiment,fullDocs[i].entities.bancos,fullDocs[i].entities.porcentaje,fullDocs[i].entities.tarjeta,fullDocs[i].entities.indicador,fullDocs[i].entities.palabraspositiva,fullDocs[i].entities.palabrasnegativas,fullDocs[i].entities.beneficios],
              function(error, result) {
                if (error) {
                    console.log(error);
                } else {
                    console.log(result);
                }
              }
            );
          }
        }
        
      });

    }
  })
}

addDocumentMySql("extracted_metadata.filename::\"T1_FUR01568670.docx\"")
console.log("fin del script")