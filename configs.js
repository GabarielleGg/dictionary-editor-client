var parser_host = 'parser.dev.metaml.net';
var parser_service = '/rest/iemlparser';
var parser_url = 'http://' + parser_host + parser_service;

var api_host = 'localhost:5000';
var api_url = 'http://' + api_host;

var mongo_url =  'mongodb://localhost:27017/';

module.exports = {
    mongo_url: mongo_url,
    parser_url: parser_url,
    parser_service: parser_service,
    parser_host: parser_host,
    api_url: api_url
};