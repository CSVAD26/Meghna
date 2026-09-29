function setup() {
  // size of the canvas to 400 x 400 pixels
  createCanvas(400, 400);
  // background color
  background(0, 0, 0);
  // setting rect mode to center
  rectMode(CENTER);
  

}

function draw() {
  fill(255,0,0);
  // red 400 x 400 pixels rectangle
  rect(width / 2, height / 2, 300, 300);
  fill(0,0,255);
  circle(width/2, height/2,300);
  fill(255, 255, 255);
  // left eye
  circle(width / 2 - 60, height / 2 - 60, 100);
  // right eye
  circle(width / 2 + 60, height / 2 - 60, 100);
  fill(0, 0, 0);
  // left pupil
  circle(width / 2 - 45, height / 2 - 45, 50); 
  // right pupil
  circle(width / 2 + 75, height / 2 - 45, 50); 

  // isolated transparent layer for the mouth
  let mouthLayer = createGraphics(400, 400);

  // drawing mouth on isolated layer
  mouthLayer.fill(0, 0, 0);
  mouthLayer.ellipse(width / 2, height / 2 + 40, 150, 100);

  // erasing ONLY from  isolated layer
  mouthLayer.erase();
  mouthLayer.ellipse(width / 2, height / 2 + 15, 150, 100);
  mouthLayer.noErase();

  // stamping isolated layer onto main canvas
  image(mouthLayer, 0, 0);

  // nose
  fill(0, 0, 0);
  ellipse(width / 2, height / 2 + 15, 40, 30);
}
