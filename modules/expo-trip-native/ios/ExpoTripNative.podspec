Pod::Spec.new do |s|
  s.name           = 'ExpoTripNative'
  s.version        = '1.0.0'
  s.summary        = 'Trip Countdown private storage boundary'
  s.description    = 'Prepares an application-private directory excluded from system backup.'
  s.author         = 'Trip Countdown'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
