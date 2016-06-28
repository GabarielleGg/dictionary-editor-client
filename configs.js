var parser_host = 'parser.dev.metaml.net';
var parser_service = '/rest/iemlparser';
var parser_url = 'http://' + parser_host + parser_service;

var mongo_url =  'mongodb://localhost:27017/';

module.exports = {
    mongo_url: mongo_url,
    parser_url: parser_url,
    parser_service: parser_service,
    parser_host: parser_host
};