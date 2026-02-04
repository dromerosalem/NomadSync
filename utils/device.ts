export const getOperatingSystem = (): 'iOS' | 'Android' | 'Other' => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return 'iOS';
  }

  // Android detection
  if (/android/i.test(userAgent)) {
    return 'Android';
  }

  return 'Other';
};
