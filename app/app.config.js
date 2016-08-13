app.config(['$locationProvider', '$routeProvider',function($locationProvider, $routeProvider) {
	$locationProvider.hashPrefix('!');

	$routeProvider
	.when('/dong-vat', {
		templateUrl: 'views/users/add-animal-form.template.html',
		controller: 'AnimalFormCtrl'
	})
	.when('/thuc-vat', {
		templateUrl: 'views/users/add-vegetable-form.template.html',
		controller: 'VegetableFormCtrl'
	})
	.when('/dia-chat', {
		templateUrl: 'views/users/add-geological-form.template.html',
		controller: 'GeologicalFormCtrl'
	})
	.when('/tho-nhuong', {
		templateUrl: 'views/users/add-land-form.template.html',
		controller: 'LanFormCtrl'
	})
	.when('/co-sinh', {
		templateUrl: 'views/users/add-paleontological-form.template.html',
		controller: 'PaleontologicalFormCtrl'
	})
	.otherwise({ redirectTo: '/dong-vat' })
}]);