// If an older iOS version launches the saved installation URL, open the app itself.
if(navigator.standalone===true||matchMedia('(display-mode: standalone)').matches){location.replace('/');}
