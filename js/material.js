
angular.module('materialApp', ['ngRoute', 'ngMaterial', 'ngMessages', 'd3graph', 'ngStorage'])
    .config(function ($provide) {
        $provide.decorator('$q', function ($delegate) {
            var defer = $delegate.defer;
            $delegate.defer = function () {
                var deferred = defer();
                deferred.promise.success = function (fn) {
                    deferred.promise.then(function(response) {
                        fn(response.data, response.status, response.headers);
                    });
                    return deferred.promise;
                };
                deferred.promise.error = function (fn) {
                    deferred.promise.then(null, function(response) {
                        fn(response.data, response.status, response.headers);
                    });
                    return deferred.promise;
                };
                return deferred;
            };
            return $delegate;
        });

    })
    .config(function($routeProvider, $locationProvider) {

        $routeProvider
            .when('/', {
                controller: 'loadIEMLController',
                templateUrl: './js/partials/listTerms.html'
            })
            .when('/loadTerms', {
                controller: 'loadIEMLController',
                templateUrl: './js/partials/listTerms.html'
            })
            .when('/edit/:id', {
                controller: 'iemlEntryEditorController',
                templateUrl: './js/partials/editTerm.html'
            })
            .when('/dicEdit/IEML/:LANG/:IEML', {
                controller: 'iemlDictionaryController',
                templateUrl: './js/partials/displayTerm.html',
                reloadOnSearch: true
            })
        ;
    })
    .factory('crudFactory', function($http, $rootScope, sharedProperties, $mdDialog, $q) {

        $rootScope.showAlert = function(title, status) {
            $mdDialog.show(
                $mdDialog.alert()
                    .parent(angular.element(document.body))
                    .title(title)
                    .content(status)
                    .ok('Dismiss')
            );
        };

        function check_response(response) {
            var deferred = $q.defer();

            response.success(function(data, status, headers, config){
                if('success' in data && !data['success']) {
                    $rootScope.showAlert('Request error', data['message'])
                }
                deferred.resolve({data: data, status: status, headers: headers, config: config})
            }).error(function(data, status, headers, config) {
                deferred.reject({data: data, status: status, headers: headers, config: config})
            });

            return deferred.promise
        }

        crud_factory = {

            create : function(newData) {
                $http.defaults.headers.post["Content-Type"] = "application/json";
                $http.defaults.headers.post["Authorization"] = "Token " + $rootScope.token.value;

                newData.version = sharedProperties.dictionary_version
                return check_response($http.post(api_url + '/terms?version='+encodeURIComponent(sharedProperties.dictionary_version), newData));
            },

            modify : function(newData) {
                $http.defaults.headers.put["Content-Type"] = "application/json";
                $http.defaults.headers.put["Authorization"] = "Token " + $rootScope.token.value;

                newData.token=$rootScope.token.value;
                return check_response($http.put(api_url + '/terms?version='+encodeURIComponent(sharedProperties.dictionary_version), newData));
            },

            get_allIEML : function() {
                return check_response($http.get(api_url + '/all?version='+encodeURIComponent(sharedProperties.dictionary_version)));
            },

            remove : function(id) {
                $http.defaults.headers.delete = {
                    "Authorization": "Token " + $rootScope.token.value
                }

                return check_response($http.delete(api_url + '/terms?version='+encodeURIComponent(sharedProperties.dictionary_version) + "&ieml=" + encodeURIComponent(id)));
            },

            exists : function(input, inputType) {
                return ($http.get(api_url + '/terms/' + inputType + '?id=' + encodeURIComponent(input) + '&version='+encodeURIComponent(sharedProperties.dictionary_version)));
            },

            iemlvalid : function(input) {
                // $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
                return ($http.get(api_url + '/scripts/parse?version='+encodeURIComponent(sharedProperties.dictionary_version) + '&ieml='+encodeURIComponent(input)));
            },

            iemltable : function(input) {
                // $http.defaults.headers.get["Content-Type"] = "application/x-www-form-urlencoded";
                return ($http.get(api_url + '/scripts/tables?ieml='+encodeURIComponent(input)));
            },

            rels : function(input)  {
                return check_response($http.get(api_url + '/relations?version='+encodeURIComponent(sharedProperties.dictionary_version) + '&ieml='+encodeURIComponent(input)));
            },
            getRanking : function(input) {
                return check_response($http.get(api_url + '/terms/ranking?version='+encodeURIComponent(sharedProperties.dictionary_version) + '&ieml='+encodeURIComponent(input)));
            },
            get_version : function() {
                return ($http.get(api_url + '/version'))
            },
            getRelVis: function(input) {
                return check_response($http.get(api_url + '/relations/visibility?version='+encodeURIComponent(sharedProperties.dictionary_version) + '&ieml='+encodeURIComponent(input)))
            },
            feedBackRanking: function(data) {
                $http.defaults.headers.post["Content-Type"] = "application/json";
                return $http.post(api_url + '/feedback/', data)
            },
            getFeedback: function(ieml_src) {
                return $http.get(api_url + '/feedback/'+ieml_src)
            },
            remove_feedback: function(id) {
                return $http.delete(api_url + '/feedback/'+id +'/')
            },
            update_feedback: function(id, data) {
                data = {
                    'term_src': data['term_src'],
                    'term_dest': data['term_dest'],
                    'relation': data['relation'],
                    'distance': data['distance'],
                    'comment': data['comment']
                }
                return $http.put(api_url + '/feedback/'+id +'/', data)
            }

        };
        return crud_factory
    })
    .directive('exists', function($q, $timeout, $http, crudFactory) {
        return {
            require: 'ngModel',
            link: function(scope, element, attributes, controller) {

                controller.$asyncValidators.exists = function(modelValue) {

                    //skips first validation on edit or when original value is entered
                    if (scope.doNotValidate) {

                        if (!(scope.dirtyInputs[attributes.name]&&scope.dirtyInputs[attributes.name].isDirty)){
                            scope.dirtyInputs[attributes.name]={"isDirty":true, "original_val":modelValue};
                            return $q.when();
                        } else {
                            if (scope.dirtyInputs[attributes.name].original_val==modelValue)
                                return $q.when();
                            // else do validation
                        }
                    }

                    if (controller.$isEmpty(modelValue)) {
                        // consider empty model valid
                        return $q.when();
                    }

                    var deferred = $q.defer();

                    // use attributes.name to know which line in the form is being written
                    crudFactory.exists(modelValue, attributes.name).success(function(data, status, headers, config) {
                        if (data.length == 0) {
                            // no documents found
                            deferred.resolve();
                        } else {
                            // at least one document found
                            deferred.reject();
                        }
                    }).
                    error(function(data, status, headers, config) {
                        scope.tempString = "Error executing 'exists' directive.";
                        deferred.resolve();
                    });

                    return deferred.promise;
                };
            }
        };
    })
    .directive('iemlvalid', function($q, crudFactory) {
        return {
            require: 'ngModel',
            link: function(scope, element, attributes, controller) {
                controller.$asyncValidators.iemlvalid = function(modelValue) {

                    if (controller.$isEmpty(modelValue)) {
                        // consider empty model valid
                        return $q.when();
                    }

                    var deferred = $q.defer();

                    crudFactory.iemlvalid(modelValue).success(function(data, status, headers, config) {
                        console.log(data.success)
                        if (data.success === true) {
                            // save computed characteristics on calling scope for later usage
                            scope.data.layer = data.level;
                            scope.data.gclass = data.class;
                            scope.data.taille = data.taille;
                            scope.data.canonical = data.canonical;
                            scope.data.rootIntersections = data.rootIntersections;
                            scope.data.containsSize = data.containsSize;
                            scope.data.factorization = data.factorization;

                            var i = data.rootIntersections.indexOf(modelValue);
                            if(i > -1) {
                                scope.data.rootIntersections.splice(i, 1)
                            }

                            deferred.resolve();
                        } else {
                            deferred.reject();
                        }
                    }).error(function(data, status, headers, config) {
                        deferred.reject();
                    });

                    return deferred.promise;
                };
            }
        };
    })
    .service('sharedProperties', function ($rootScope, $localStorage) {

        // will determine how to configure controller
        var EntryEditType = null;
        // ieml of current interest
        var iemlEntry;

        $rootScope.token = $localStorage.$default({value:''});

        shared_properties = {
            updating : false,
            updatingStatus : '',

            // 'static' variables for 'sharedProperties'
            FromListNew : "FromListNew",
            FromListUpdate : "FromListUpdate",
            FromTableNew : "FromTableNew",
            FromTableUpdate : "FromTableUpdate",

            setEntryEditType:function(editType) {
                if (editType === this.FromListNew)
                    EntryEditType = this.FromListNew;
                else if (editType === this.FromListUpdate)
                    EntryEditType = this.FromListUpdate;
                else if (editType === this.FromTableNew)
                    EntryEditType = this.FromTableNew;
                else if (editType === this.FromTableUpdate)
                    EntryEditType = this.FromTableUpdate;
                else
                    EntryEditType = null;
            },
            getEntryEditType:function(){
                return EntryEditType;
            },

            getIemlEntry: function () {
                return iemlEntry;
            },

            setIemlEntry: function(value) {
                iemlEntry = value;
            },

            dictionary_version : null,

            defaultSelected: 1,
            allItems: []
        };

        return shared_properties
    })
    .factory('NotifyingService', function($rootScope) {
        return {
            subscribe: function(scope, callback) {
                var handler = $rootScope.$on('dictionary_updated', callback);
                scope.$on('$destroy', handler);
            },

            notify: function() {
                $rootScope.$emit('dictionary_updated');
            }
        };
    })
    .controller('iemlEntryEditorController', function($scope,  $rootScope, $location, $window, crudFactory, sharedProperties, NotifyingService) {

        var currIemlEntry = null;

        $scope.sharedProperties = sharedProperties;
        $scope.data = {};
        $scope.data.isParadigm = false;
        $scope.data.layer = 'n/a';
        $scope.data.gclass = 'n/a';
        $scope.data.rootIntersections = [];
        $scope.data.containsSize = 0;
        $scope.formTitle = 'Adding new entry';
        $scope.doNotValidate = false;
        $scope.data.factorization = '';
        $scope.readOnly = true;

        var AscSub = "Ancestors in substance";
        var AscAtt = "Ancestors in attribute";
        var AscMod = "Ancestors in mode";
        var DscSub = "Descendents in substance";
        var DscAtt = "Descendents in attribute";
        var DscMod = "Descendents in mode";
        var GermainJumeau ="Twin siblings";
        var GermainOpposes ="Opposed siblings";
        var GermainAssocies ="Associated siblings";
        var GermainCroises = "Crossed siblings";

        $scope.editing = null;

        $scope.enableRelationsArray = [AscSub, AscAtt, AscMod, GermainJumeau, GermainOpposes, GermainAssocies, GermainCroises];
        $scope.enableRelationsArraySelected = [];

        $scope.updateIeml = function () {
            $scope.iemlValue = $scope.data.factorization
        };


        var ignore_contained_edit_ieml = function () {
            if($scope.editing) {
                var i = $scope.data.rootIntersections.indexOf(currIemlEntry._id);
                if (i > -1) {
                    $scope.data.rootIntersections.splice(i, 1)
                }
            }
        };

        $scope.rootConditions = function () {
            ignore_contained_edit_ieml();

            return {
                intersection: $scope.data.rootIntersections.length != 0,
                rootAndNonEmpty: $scope.data.isParadigm && $scope.data.containsSize != 0
            }
        };

        $scope.isRootEditable = function () {
            ignore_contained_edit_ieml();

            if($scope.data.rootIntersections.length == 0) {
                if($scope.data.isParadigm && $scope.data.containsSize) {
                    $scope.data.isParadigm = true;
                    return false
                }

                return true
            } else {
                if(currIemlEntry)
                    $scope.data.isParadigm = currIemlEntry.ROOT_PARADIGM
                else
                    $scope.data.isParadigm = false;
                return false
            }
        };


        $scope.toggle = function (item, list) {
            var idx = list.indexOf(item);
            if (idx > -1) list.splice(idx, 1);
            else list.push(item);
        };

        $scope.exists = function (item, list) {
            return list.indexOf(item) > -1;
        };

        init();

        function init() {

            currIemlEntry = sharedProperties.getIemlEntry();
            sharedProperties.setIemlEntry(null);

            var configOption = sharedProperties.getEntryEditType();
            if (configOption != null){

                if (configOption === sharedProperties.FromListNew){
                    $scope.readOnly  = false;
                }
                else if (configOption === sharedProperties.FromListUpdate) {
                    $scope.editing = true;
                    $scope.readOnly  = false;
                    bindValues(currIemlEntry); // ieml exists, just update it
                    crudFactory.getRelVis(currIemlEntry.IEML).success(function(data, status){
                        $scope.enableRelationsArraySelected = data.slice();
                    });
                }
                else if (configOption === sharedProperties.FromTableNew) {
                    $scope.iemlValue = sharedProperties.tileIEML; //this is coming from table tile
                    sharedProperties.tileIEML = null; // clean-up
                    crudFactory.getRelVis($scope.iemlValue).success(function(data, status){
                        $scope.enableRelationsArraySelected = data.viz.slice();
                    });
                }
                else if (configOption === sharedProperties.FromTableUpdate) {
                    $scope.editing = true;
                    bindValues(currIemlEntry); // ieml exists, just update it
                    crudFactory.getRelVis(currIemlEntry.IEML).success(function(data, status){
                        $scope.enableRelationsArraySelected = data.viz.slice();
                    });
                }

                // clean-up
                sharedProperties.setEntryEditType(null);
            }
            else {
                $location.path('/');
            }
        };

        function bindValues(binding) {
            if (binding == null) debugger;

            $scope.formTitle = 'Editing ' + binding.IEML;
            $scope.iemlValue = binding.IEML;
            $scope.frenchValue = binding.FR;
            $scope.englishValue = binding.EN;
            $scope.doNotValidate = true; // do not validate in some cases since ieml exists
            $scope.dirtyInputs = [];
            $scope.data.isParadigm = binding.ROOT_PARADIGM;
            $scope.data.layer = binding.LAYER;
            $scope.data.gclass = binding.CLASS;
            $scope.data.taille = binding.TAILLE;
            $scope.data.canonical = binding.CANONICAL;

        };

        $scope.cancelEdit = function() {
            $window.history.back();
        };

        $scope.submitEdit = function() {

            var toBeAdded = {
                IEML:$scope.iemlValue,
                FR:$scope.frenchValue,
                EN:$scope.englishValue,
                PARADIGM:$scope.data.isParadigm ? "1" : "0",
                ID:$scope.editing?currIemlEntry._id:undefined,
                INHIBITS: $scope.enableRelationsArraySelected
            };
            sharedProperties.updating = true

            if (toBeAdded.ID==undefined) {
                crudFactory.create(toBeAdded).success(function(data) {

                    sharedProperties.updating = false

                    crudFactory.get_version().success(function(value) {
                        sharedProperties.dictionary_version = value;
                        crudFactory.get_allIEML().success(function(data) {
                            sharedProperties.allItems = data;
                            NotifyingService.notify()
                        });
                    });

                }).error(function(data, status, headers, config) {

                    if (!data.success) {
                        $rootScope.showAlert('Create operation failed', data.message?data.message:'This operation requires authentication.');
                    } else {
                        $rootScope.showAlert('Create operation failed', status);
                    }

                    sharedProperties.updating = false
                });
            } else { //do update

                crudFactory.modify(toBeAdded).success(function(data, status, headers, config){

                    sharedProperties.updating = false

                    crudFactory.get_version().success(function(value) {
                        sharedProperties.dictionary_version = value;
                        crudFactory.get_allIEML().success(function(data) {
                            sharedProperties.allItems = data;
                            NotifyingService.notify()

                        });

                    });

                }).error(function(data, status, headers, config) {

                    if (!data.success) {
                        $rootScope.showAlert('Modify operation failed', data.message?data.message:'This operation requires authentication.');
                    } else {
                        $rootScope.showAlert('Modify operation failed', status);
                    }
                    sharedProperties.updating = false

                });
            }

            $window.history.back()
        };
    })
    .controller('loadIEMLController', function($scope,  $rootScope, $location, $mdDialog, $filter, crudFactory, sharedProperties, NotifyingService) {

        var fParadigms = "Paradigms";
        var fSingularSequence = "Singular Sequence";
        var fRootParadigms = "Root Paradigms";
        var fAllTerms = "All terms";
        var fAllClasses = "All classes";
        var fAuxClass = "Auxiliary class";
        var fVerbClass = "Verb class";
        var fNounClass = "Noun class";
        var fAllLayers = "All layers";
        var fLayer0 = "Layer 0";
        var fLayer1 = "Layer 1";
        var fLayer2 = "Layer 2";
        var fLayer3 = "Layer 3";
        var fLayer4 = "Layer 4";
        var fLayer5 = "Layer 5";
        var fLayer6 = "Layer 6";

        $scope.sharedProperties = sharedProperties

        $scope.filterParadigmChoices = [
            fAllTerms,
            fParadigms,
            fSingularSequence,
            fRootParadigms
        ];

        $scope.filterClassChoices = [
            fAllClasses,
            fAuxClass,
            fVerbClass,
            fNounClass
        ];

        $scope.filterLayerChoices = [
            fAllLayers,
            fLayer0,
            fLayer1,
            fLayer2,
            fLayer3,
            fLayer4,
            fLayer5,
            fLayer6
        ];

        var fFrench = "Français";
        var fEnglish = "English";
        $scope.filterLanguageChoices = [
            fFrench,
            fEnglish
        ];

        var iemlOrder = "IEML";
        var alphOrder = "Alphabetical";
        $scope.filterOrderChoices = [
            iemlOrder,
            alphOrder
        ];

        // set defaults
        $scope.filterParadigm = sharedProperties.filterParadigmSelected?sharedProperties.filterParadigmSelected:fAllTerms; //default value
        $scope.filterClass = sharedProperties.filterClassSelected?sharedProperties.filterClassSelected:fAllClasses; //default value
        $scope.filterLayer = sharedProperties.filterLayerSelected?sharedProperties.filterLayerSelected:fAllLayers; //default value
        $scope.filterLanguage = sharedProperties.filterLanguageSelected?sharedProperties.filterLanguageSelected:fFrench; //default value
        $scope.filterOrder = sharedProperties.filterOrderSelected?sharedProperties.filterOrderSelected:iemlOrder; //default value
        $scope.filterText = sharedProperties.filterTextSelected?sharedProperties.filterTextSelected:""; //default value

        if(!('filterParadigmSelected' in sharedProperties)) {
            sharedProperties.filterClassSelected=$scope.filterClass;
            sharedProperties.filterLayerSelected=$scope.filterLayer;
            sharedProperties.filterParadigmSelected=$scope.filterParadigm;
            sharedProperties.filterLanguageSelected=$scope.filterLanguage;
            sharedProperties.filterOrderSelected=$scope.filterOrder;
            sharedProperties.filterTextSelected=$scope.filterText;
        }

        $scope.triggerFiltering = function (selection) {
            //store selected filters in the service to preserve values
            sharedProperties.filterClassSelected=$scope.filterClass;
            sharedProperties.filterLayerSelected=$scope.filterLayer;
            sharedProperties.filterParadigmSelected=$scope.filterParadigm;
            sharedProperties.filterLanguageSelected=$scope.filterLanguage;
            sharedProperties.filterOrderSelected=$scope.filterOrder;
            sharedProperties.filterTextSelected=$scope.filterText;
            //alert(selection);

            // 'ORDER' and 'LANGUAGE' are not filtering but ordering by and
            // selecting a language to display respectively.
            if ((selection === 'ORDER' || selection === 'LANGUAGE') /*&& $scope.filterOrder == alphOrder*/) {
                orderList();
            }
        };

        $scope.filterItemIeml = function(selection) {
            return function(input) {
                if (selection.length == 0) return true;

                if (input.IEML.indexOf(selection) > -1)
                    return true;

                if ($scope.filterLanguage == fFrench) {
                    if (input.FR.indexOf(selection) > -1)
                        return true;
                }
                else {
                    if (input.EN.indexOf(selection) > -1)
                        return true;
                }

                return false;
            }
        };

        //http://stackoverflow.com/questions/11753321/passing-arguments-to-angularjs-filters
        $scope.filterGrammaticalClass = function(selection) {
            return function(input) {
                if (selection === fAllClasses) {
                    return true;
                }

                var v;
                if (selection === fAuxClass)
                    v = 0;
                if (selection === fVerbClass)
                    v = 1;
                if (selection === fNounClass)
                    v = 2;
                if (input.CLASS == v.toString())
                    return true;

                return false;
            }
        };

        $scope.filterItemLayer = function(selection) {
            return function(input) {

                if (selection === fAllLayers)
                    return true;

                if (input.LAYER == ($scope.filterLayerChoices.indexOf(selection) - 1).toString())
                    return true;

                return false;
            }
        };

        $scope.filterItemParadigm = function(selection) {
            return function(input) {

                if (selection === fAllTerms)
                    return true;

                if (selection === fRootParadigms && input.ROOT_PARADIGM == true)
                    return true;

                if (selection === fParadigms && input.PARADIGM == "1")
                    return true;

                return selection === fSingularSequence && input.PARADIGM == "0";
            }
        };

        function orderList() {
            var orderBy = $filter('orderBy');

            function order(predicate, reverse) {
                $scope.List = orderBy($scope.List, predicate, reverse);
            }

            function iemlOrderFunction(a, b){
                return a.INDEX - b.INDEX
            }

            if ($scope.filterOrder === iemlOrder) {
                $scope.List.sort(iemlOrderFunction);
            }
            else {
                if ($scope.filterLanguage === fFrench)
                    order('-FR',true);

                if ($scope.filterLanguage === fEnglish)
                    order('-EN',true);
            }
        };
        NotifyingService.subscribe($scope, () => {
            $scope.List = sharedProperties.allItems;
            orderList();
        });

        console.log(sharedProperties.allItems);
        if (sharedProperties.allItems.length == 0) {
            crudFactory.get_version().success(function(value) {
                sharedProperties.dictionary_version = value;
                crudFactory.get_allIEML().success(function(data) {
                    sharedProperties.allItems = data;
                    $scope.List = sharedProperties.allItems;
                    orderList();
                });
            });
        } else {
            $scope.List = sharedProperties.allItems;
            orderList();
        }

        $scope.showConfirm = function(callBack, index) {
            // Appending dialog to document.body to cover sidenav in docs app
            var confirm = $mdDialog.confirm()
                .parent(angular.element(document.body))
                .title('Would you like to delete this entry?')
                .content('It will be permanently removed from the database.')
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(function() {
                callBack(index);
            }, function() {
                //nothing
            });
        };

        $scope.deleteEntry = function ( index ) {

            var toBeRemoved = $scope.List[index].IEML;
            sharedProperties.updating = true

            crudFactory.remove(toBeRemoved).success(function(data) {
                sharedProperties.updating = false

                crudFactory.get_version().success(function(value) {
                    sharedProperties.dictionary_version = value;
                    crudFactory.get_allIEML().success(function(data) {
                        sharedProperties.allItems = data;
                        NotifyingService.notify()
                    });
                });

            }).error(function(data, status, headers, config) {
                sharedProperties.updating = false

                // called asynchronously if an error occurs
                // or server returns response with an error status.
                // this won't work in case you cannot connect to db
                // because of long (infinite?) time-outs
                if (!data.success&&data.message) {
                    $scope.showAlert('Delete operation failed', data.message?data.message:'This operation requires authentication.')
                } else {
                    $scope.showAlert('Delete operation failed', status);
                }
            });
        };

        $scope.showAlert = function(title, status) {
            $mdDialog.show(
                $mdDialog.alert()
                    .parent(angular.element(document.body))
                    .title(title)
                    .content(status)
                    .ok('Dismiss')
            );
        };

        $rootScope.showAlert = function(title, status) {
            $mdDialog.show(
                $mdDialog.alert()
                    .parent(angular.element(document.body))
                    .title(title)
                    .content(status)
                    .ok('Dismiss')
            );
        };

        // valid index if from List
        $scope.editEntry = function ( index ) {

            if (index === -1) {
                sharedProperties.setEntryEditType(sharedProperties.FromListNew);
                $location.path('/edit/new');
            } else {
                sharedProperties.setIemlEntry($scope.List[index]);
                sharedProperties.setEntryEditType(sharedProperties.FromListUpdate);
                $location.path('/edit/' + index);
            }
        };

        //
        $scope.showDicEdit = function( index ) {
            if (index < 0) {
                // do nothing: error condition
            } else {
                var toBeEdited = $scope.List[index];
                sharedProperties.setIemlEntry(toBeEdited);
                var earl = '/dicEdit/IEML/' + encodeURIComponent(sharedProperties.filterLanguageSelected == 'Français' ? 'FR' : 'EN') +
                    '/'+encodeURIComponent(toBeEdited.IEML);
                $location.path(earl);
            }
        };

    })
    .controller ('toastControler',function($scope, $mdToast, $mdDialog, $location, sharedProperties){

        init();

        function init(){
            // Used to populate html
            $scope.tableTile = sharedProperties.tableTile;
        };

        // Called from html. For a given ieml, FR/EN exist: allow only edits of non-ieml field
        $scope.editTile = function (tableTile) {

            $mdDialog.hide();

            var lst = sharedProperties.allItems;
            for (var i=0;i<lst.length; i++) {
                if (lst[i].IEML == tableTile.value) {
                    sharedProperties.setIemlEntry(lst[i]);
                    sharedProperties.setEntryEditType(sharedProperties.FromTableUpdate);
                    $location.path('/edit/' + i);
                    return;
                }
            }
        }

        // Called from html. For a given ieml, FR/EN do NOT exist: allow only edits of non-ieml field
        $scope.createIEMLfromTile = function (tableTile) {
            $mdDialog.hide();
            sharedProperties.tileIEML = tableTile.value;
            sharedProperties.setEntryEditType(sharedProperties.FromTableNew);
            $location.path('/edit/new');
        }
    })
    .controller('iemlDictionaryController', function($scope, $window, $location, $mdToast, $rootScope, $routeParams, $mdDialog, $document, $filter, crudFactory, sharedProperties, NotifyingService) {

        var tableTitle = decodeURIComponent($routeParams.IEML);
        var language = decodeURIComponent($routeParams.LANG);
        $scope.language = language;

        $scope.sh = sharedProperties;

        var previousTableTile = tableTitle;
        var lstAllIEML = sharedProperties.allItems;

        // the language selection drop-down related code
        var lFrench = "Français";
        var lEnglish = "English";

        $scope.displayLanguageChoices = [
            lFrench,
            lEnglish
        ];
        $scope.displayLanguage = language=='FR' ? lFrench: lEnglish;

        $scope.changeDisplayLanguage = function () {
            sharedProperties.filterLanguageSelected = $scope.displayLanguage;
            var earl = '/dicEdit/IEML/' + encodeURIComponent(sharedProperties.filterLanguageSelected == 'Français' ? 'FR' : 'EN') +
                '/'+encodeURIComponent(tableTitle);
            $location.path(earl);
        };

        $scope.crossCheck = function( input) {
            var newTemp = $filter("filter")(lstAllIEML, {IEML:input}, true);
            return newTemp;
        };

        $scope.lookupLabels = function (inieml) {

            var res = {};

            if (inieml == undefined)
                return res;

            var newTemp = $filter("filter")(lstAllIEML, {IEML:inieml}, true);

            if (newTemp == undefined)
                return res;

            if (newTemp.length == 0)
                return res;

            res.EN = newTemp[0]?newTemp[0].EN:"none";
            res.FR = newTemp[0]?newTemp[0].FR:"none";

            if (language == "FR") {
                res.DISP = newTemp[0]?newTemp[0].FR:"none";
            }
            else {
                res.DISP = newTemp[0]?newTemp[0].EN:"none";
            }

            return res;
        };

        function orderRelationsList() {

            function getRelVal(name) {

                if (name == "Belongs to Paradigm")
                    return 0;
                if (name == "Contains")
                    return 1;
                if (name == "Contained in")
                    return 2;
                if (name == "Associated siblings")
                    return 3;
                if (name == "Opposed siblings")
                    return 4;
                if (name == "Twin siblings")
                    return 5;
                if (name == "Crossed siblings")
                    return 6;
                if (name == "Ancestors in substance")
                    return 7;
                if (name == "Ancestors in attribute")
                    return 8;
                if (name == "Ancestors in mode")
                    return 9;
                if (name == "Descendents in substance")
                    return 10;
                if (name == "Descendents in attribute")
                    return 11;
                if (name == "Descendents in mode")
                    return 12;
                return 13;
            }

            function relationsOrderFunction(a, b){
                var a_val = getRelVal(a.reltype);
                var b_val = getRelVal(b.reltype);
                if (a_val < b_val)
                    return -1;
                if (a_val > b_val)
                    return 1;
                return 0;
            }

            function iemlOrderFunction(a_name, b_name){

                if (!a_name.exists && !b_name.exists)
                    return 0;
                if (a_name.exists && !b_name.exists)
                    return -1;
                if (!a_name.exists && b_name.exists)
                    return 1;

                var a_arr = a_name.entry;
                var b_arr = b_name.entry;

                if (a_arr == undefined || b_arr == undefined)
                    return 0;

                if (a_arr.length == 0 || b_arr.length == 0)
                    return 0;

                var a = a_arr[0];
                var b = b_arr[0];

                //http://www.javascriptkit.com/javatutors/arraysort.shtml
                //http://stackoverflow.com/questions/979256/sorting-an-array-of-javascript-objects
                //Compare "a" and "b" in some fashion, and return -1, 0, or 1
                if (parseInt(a.LAYER) < parseInt(b.LAYER))
                    return 1;
                if (parseInt(a.LAYER) > parseInt(b.LAYER))
                    return -1;
                if (parseInt(a.TAILLE) < parseInt(b.TAILLE))
                    return 1;
                if (parseInt(a.TAILLE) > parseInt(b.TAILLE))
                    return -1;

                if (a.CANONICAL.length == b.CANONICAL.length) {

                    var i=0, len=a.CANONICAL.length;
                    for (; i<len; i++) {
                        var comp = b.CANONICAL[i].localeCompare(a.CANONICAL[i]);
                        if (comp == 0)
                            continue;
                        return comp;
                    }
                } else if (a.CANONICAL.length < b.CANONICAL.length) {
                    var i=0, len=a.CANONICAL.length;
                    for (; i<len; i++) {
                        var comp = b.CANONICAL[i].localeCompare(a.CANONICAL[i]);
                        if (comp == 0)
                            continue;
                        return comp;
                    }
                } else {
                    var i=0, len=b.CANONICAL.length;
                    for (; i<len; i++) {
                        var comp = b.CANONICAL[i].localeCompare(a.CANONICAL[i]);
                        if (comp == 0)
                            continue;
                        return comp;
                    }
                }

                return 0;
            }

            // sort relation names
            $scope.definitions.sort(relationsOrderFunction);
            // sort relation endpoints based on ieml order
            $scope.definitions.forEach(function(el){
                if (el.rellist.length > 1) {
                    for(var i = 0; i< el.rellist.length; i++) {
                        el.rellist[i].entry = $filter("filter")(lstAllIEML, {IEML: el.rellist[i].ieml}, true);
                    }
                    el.rellist.sort(iemlOrderFunction)
                }
            });
        };

        // if a table cannot be generated for a particular input,
        // we show tables that contain the input. This filters all
        // relations for the 'contain' relations.
        $scope.filterContainedRelations = function() {

            return function(input) {
                if (input.reltype == "Belongs to Paradigm" ||
                    input.reltype == "Contained in" )
                    return true;

                return false;
            }
        };

        retrieve_feedback = function() {crudFactory.getFeedback(tableTitle).success(function(data) {
                $scope.feed_back = {};
                $scope.data = {};
                for (term of $scope.ranking) {
                    term.valid = true;
                    term.distance = term.ranking[1];
                    term.distance_str =  String(term.distance).substring(0, 5);

                    if (term.ieml == tableTitle)
                        continue;

                    for (term_feed_back of data) {

                        if (term.ieml == term_feed_back.term_src || term.ieml == term_feed_back.term_dest) {
                            if ((term_feed_back.relation == 'remove' && term.distance < 1.0)
                            || (term_feed_back.relation == 'up' && term.distance >= term_feed_back.distance)
                            || (term_feed_back.relation == 'down' && term.distance <= term_feed_back.distance)) {
                                term.valid = false;
                            }

                            map = {
                                'up': '>',
                                'down': '<',
                                'remove': '>'
                            }

                            rule = map[term_feed_back.relation] + " " + (term_feed_back.relation == 'remove' ? 1.0 : term.distance_str)

                            $scope.feed_back[term.ieml] = {
                                'state': term_feed_back.relation,
                                'distance': term_feed_back.distance,
                                'rule': rule,
                                'id': term_feed_back.id,
                                'term': term
                            }

                            $scope.data[term_feed_back.id] = {
                                'relation': term_feed_back.relation,
                                'distance': parseFloat(String(term_feed_back.distance).substring(0, 4)),
                                'comment': term_feed_back.comment
                            }

                            break;
                        }
                    }
                }
            })
        }

        $scope.feed_back = []
        $scope.ranking = [];

        $scope.compute_ranking = false;
        $scope.getRanking = function() {
            $scope.compute_ranking = true;
            crudFactory.getRanking(tableTitle).success(function(data) {
                $scope.compute_ranking = false;
                $scope.ranking = data
                retrieve_feedback();
            });

        }

        $scope.feedback = function(term, type, distance, comment) {
            data = {
                'term_src': tableTitle,
                'term_dest': term.ieml,
                'relation': type,
                'distance': distance,
                'comment': comment,
            }

            console.log(data);

            if (term.ieml in $scope.feed_back) {
                crudFactory.update_feedback($scope.feed_back[term.ieml].id, data).success(function(data) {
                    retrieve_feedback();
                });
            } else {
                crudFactory.feedBackRanking(data).success(function(data) {
                    retrieve_feedback();
                })
            }
        }

        $scope.remove_feedback = function(id) {
            crudFactory.remove_feedback(id).success(function (data) {
                retrieve_feedback();
            });
        }

        function init() {

            // TODO: if from bookmark, this will be undefined.
            $scope.filterLanguage = sharedProperties.filterLanguageSelected;
            $scope.DefinedEntry = {};

            sharedProperties.setIemlEntry(null);

            function callback() {
                lstAllIEML = sharedProperties.allItems;
                $scope.tableTitle = tableTitle;
                // get other info from entry
                entry = $filter("filter")(lstAllIEML, {IEML: tableTitle}, true)[0];
                if (!entry) {
                    $rootScope.showAlert('Term not existant', tableTitle)
                    $location.path('/');
                    return
                }
                $scope.DefinedEntry = entry;


                $scope.DefinedEntryClass = "n/a";
                if ($scope.DefinedEntry.CLASS == "0")
                    $scope.DefinedEntryClass = "Auxilliary";
                if ($scope.DefinedEntry.CLASS == "1")
                    $scope.DefinedEntryClass = "Verb";
                if ($scope.DefinedEntry.CLASS == "2")
                    $scope.DefinedEntryClass = "Noun";


                crudFactory.rels(tableTitle).success(function(allrels) {

                    var parent_paradigm = "none";

                    //get the viz
                    for (var i = 0; i < allrels.length; i++) {
                        if (allrels[i].reltype == "Belongs to Paradigm") {
                            parent_paradigm = allrels[i].rellist[0].ieml;
                            break;
                        }
                    }

                    // if null, it could be a paradigm or something weird, try wit itself
                    if (parent_paradigm == "none")
                        parent_paradigm = tableTitle;

                    $scope.definitions = allrels;
                    orderRelationsList();
                });

                crudFactory.iemltable(tableTitle).success(function(data) {
                    $scope.fakeReply = data.tree;
                    $scope.showTables = false;

                    if (data.success == false) {
                        $scope.tableError = data.exception;
                    } else {
                        $scope.DefinedEntry.MULTIPLE_TABLES = $scope.fakeReply.Tables.lenght != 1

                        for (var table of $scope.fakeReply.Tables) {
                            $scope.showTables = $scope.showTables || table.dim != 0
                            for (var tab of table.table) {
                                for (var slice of tab.slice) {
                                    var input = slice.value;
                                    if (input != "") {
                                        var means = $scope.crossCheck(input);
                                        if (means != undefined && means.length > 0) {
                                            var f = means[0].FR;
                                            var e = means[0].EN;

                                            // https://github.com/angular/material/issues/2583

                                            slice.means.fr = f;
                                            slice.means.en = e;
                                            slice.creatable = false;
                                            slice.editable = true;
                                        } else {
                                            // there is no FR or EN, instead of showing blank, show some ieml
                                            slice.means.en = slice.value;
                                            // on click, we have the option to create ieml in DB
                                            slice.creatable = true;
                                            slice.editable = false;
                                        }
                                    }

                                }
                            }
                        }

                        $scope.materialTables = $scope.fakeReply.Tables;
                    }
                });
            }

            if(sharedProperties.allItems.length == 0) {
                crudFactory.get_version().success(function(value) {
                    sharedProperties.dictionary_version = value;

                    crudFactory.get_allIEML(sharedProperties.dictionary_version).success(function (data) {
                        sharedProperties.allItems = data;
                        callback()
                        NotifyingService.notify()
                    })
                });
            } else {
                callback()
            }

                // });

        }

        // user clicked on a cell in the table: trigger an action.
        $scope.showLables = function (tableTile) {

            // remember which cell was clicked, will be used in 'toastControler'
            sharedProperties.tableTile=tableTile;

            if (tableTile.editable||tableTile.creatable) {
                $mdDialog.show({
                    controller:'toastControler',
                    templateUrl: 'js/templates/toast1.tmpl.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose:true
                });
            }
        };

        $scope.cancelEdit = function() {
            if($window.history.length == 0) {
                $location.path('/loadTerms');
            } else {
                $window.history.back();
            }

        };

        init();
    })
    .controller('welcomeController', function($scope, $location) {

        $scope.topDirections = ['left', 'up'];
        $scope.bottomDirections = ['down', 'right'];
        $scope.isOpen = false;
        $scope.availableModes = ['md-fling', 'md-scale'];
        $scope.selectedMode = 'md-scale';
        $scope.availableDirections = ['up', 'down', 'left', 'right'];
        $scope.selectedDirection = 'right';

        init();

        function init() {
        }

        $scope.viewEntry = function ( index ) {
            var earl = '/loadTerms/';
            $location.path(earl);
        };
    })
    .controller('mainMenuController', function($rootScope, $scope, $location, $mdDialog, sharedProperties, crudFactory) {
        $scope.sharedProperties = sharedProperties;

        $scope.editEntry = function ( index ) {
            sharedProperties.setEntryEditType(sharedProperties.FromListNew);
            $location.path('/edit/new');
        };

        $scope.isShowAddNew = function () {
            return ($rootScope.token.value !== "");
        };

        delete_token = function() {
            $rootScope.token.value = "";
        };

        $scope.updateRelations = function() {
            sharedProperties.updating = true;

            crudFactory.updateRelations().success(function (data) {
                sharedProperties.updating = false
            });
            $location.path('/');
        };

        $scope.showSignIn = function(ev) {
            if($scope.isShowAddNew()) {
                delete_token()
            } else {
                $mdDialog.show({
                    controller: DialogController,
                    templateUrl: 'js/templates/dialog1.tmpl.html',
                    parent: angular.element(document.body),
                    targetEvent: ev,
                    clickOutsideToClose: true
                });
            }
        };

        function DialogController($scope, $mdDialog, $http, sharedProperties, $rootScope) {

            $scope.error = undefined;
            $scope.dataLoading = false;
            $scope.formData = {};

            $scope.cancel = function($event) {
                $event.preventDefault();
                $mdDialog.cancel();
            };

            $scope.login = function(form) {
                $scope.dataLoading = true;
                data = {
                    'username': $scope.formData['name'],
                    'password': $scope.formData['password']
                }
                $http({
                    method  : 'POST',
                    url     : api_url + '/login/',
                    data    : $.param(data),  // pass in data as strings
                    headers : { 'Content-Type': 'application/x-www-form-urlencoded' }  // set the headers so angular passing info as form data (not request payload)
                }).then(function(response) {console.log(response);
                    $scope.dataLoading=false;
                    // sharedProperties.secToken=response.data.token;
                    $rootScope.token.value = response.data.token;
                    $mdDialog.cancel();
                }, function(response) {
                    $scope.error = response.data.non_field_errors[0];
                    $scope.dataLoading = false;

                });
            }
        }
    });
