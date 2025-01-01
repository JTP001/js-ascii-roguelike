// font size 
var FONT = 32;

// map dimensions
var ROWS = 10;
var COLS = 15;

// # of actors per level, including the player
var ACTORS = 5;

// the map
var map;

// the ascii display, as a 2d array of characters
var asciidisplay;

// the player actor
var player = {x:0, y:0, hp:3};

// the number of living enemies
var livingEnemies;

// a list of all actors; 0 is the player
var actorList;

// a map that points to each actor in its position, for quick searching
var actorMap;

// the game's current level
var gameLevel = 1;


// initialize Phaser, call create() once done
var game = new Phaser.Game(COLS * FONT * 0.6, ROWS * FONT, Phaser.AUTO, null, {
    create: create // calls create() as soon as Phaser is done initializing
});

function create() {
    // initialize keyboard commands
    game.input.keyboard.addCallbacks(null, null, onKeyUp);

    // initialize map
    initMap();

    // initialize screen
    asciidisplay = [];
    for (var y = 0; y < ROWS; y++) {
        var newRow = [];
        asciidisplay.push(newRow);
        for (var x = 0; x < COLS; x++) {
            newRow.push( initCell('', x, y) );
        }
    }
    drawMap();

    //initialize actors
    initActors();
    drawActors();
}

function onKeyUp(event) {
    // draw the map to overwrite previous actor positions
    drawMap();

    // act on player input
    var acted = false;
    switch (event.keyCode) {
        case Phaser.Keyboard.LEFT:
            acted = moveTo(player, {x:-1, y:0})
            break;

        case Phaser.Keyboard.RIGHT:
            acted = moveTo(player, {x:1, y:0})
            break;

        case Phaser.Keyboard.UP:
            acted = moveTo(player, {x:0, y:-1})
            break;

        case Phaser.Keyboard.DOWN:
            acted = moveTo(player, {x:0, y:1})
            break;
    }

    //enemies act every time the player does
    if (acted) {
        // player is skipped by starting i at 1
        for (var i = 1; i < actorList.length; i++) {
            var e = actorList[i];
            if (e != null) {
                aiAct(e);
            }
        }
    }

    // draw actors in their new positions
    drawActors();
}

function initMap() {
    // create a new random map (# = wall, . = open)
    map = [];
    for (var y = 0; y < ROWS; y++) {
        var newRow = [];
        for (var x = 0; x < COLS; x++) {
            if (Math.random() > (0.8 + (gameLevel-1)*0.03 )) {
                newRow.push('#');
            } else {
                newRow.push('.');
            }

            // add some rare healing spots
            if (newRow[x] == '.' && Math.random() > (0.95 + (gameLevel-1)*0.01)) {
                newRow[x] = '+';
            }
        }
        map.push(newRow);
    }
}

function drawMap() {
    for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
            asciidisplay[y][x].content = map[y][x];
        }
    }
}

function initCell(chr, x, y) {
    // add a single cell in a given position to the ascii display
    var style = { font: FONT + "px monospace", fill:"#fff"};
    return game.add.text(FONT*0.6*x, FONT*y, chr, style);
}

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function initActors() {
    // create actors at random locations
    actorList = [];
    actorMap = {};
    for (var e = 0; e < ACTORS; e++) {
        // create a new actor
        var actor = { x:0, y:0, hp:e == 0?player.hp:1 };
        do {
            // pick a random position that is both a floor and not occupied
            actor.y = randomInt(ROWS);
            actor.x = randomInt(COLS);
        } while ( 
            map[actor.y][actor.x] == '#' || actorMap[actor.y + "_" + actor.x] != null 
        );

        // add references to the actor to the actors list & map
        actorMap[actor.y + "_" + actor.x] = actor;
        actorList.push(actor);
    }

    // the player is the first actor in the list
    player = actorList[0];
    livingEnemies = ACTORS-1;
}

function drawActors() {
    for (var i = 0; i < actorList.length; i++) {
        if (actorList[i] != null) {
            if (actorList[i].hp > 0) {
                var actor = actorList[i];
                asciidisplay[actor.y][actor.x].content = i == 0?''+player.hp:'e';
            } 
        }
    }
}

function canGo(actor, direction) {
    return  actor.x + direction.x >= 0 &&
            actor.x + direction.x <= COLS - 1 &&
            actor.y + direction.y >= 0 &&
            actor.y + direction.y <= ROWS - 1 &&
            (map[actor.y + direction.y][actor.x + direction.x] == '.' || 
            map[actor.y + direction.y][actor.x + direction.x] == '+');
}

// returns false or true for invalid or valid move respectively
function moveTo(actor, direction) {
    // check if the move is possible
    if (!canGo(actor, direction)) {
        return false;
    }

    // moves the actor to the new location
    var newSpace = (actor.y + direction.y) + '_' + (actor.x + direction.x);

    // first case: if there is an actor in the new space
    if (actorMap[newSpace] != null) {
        // a victim is any actor, including the player, that is taking damage
        var victim = actorMap[newSpace];

        // if neither the victim or actor ar the player, don't move successfully
        if (victim != player && actor != player) {
            return false;
        }

        // decrement hitpoints of the actor at the destination space
        victim.hp--;

        // if hp is 0, remove enemy's reference
        if (victim.hp < 1) {
            actorMap[newSpace] = null;
            actorList[actorList.indexOf(victim)] = null;

            if (victim != player) {
                livingEnemies--;

                if (livingEnemies == 0) {
                    //victory message
                    levelClear();
                }
            }
        }
    }
    // second case: if there is no actor in the space, move and update visuals
    else {
        // remove the reference to the actor's old position
        actorMap[actor.y + '_' + actor.x] = null;

        // update actor's position
        actor.y += direction.y;
        actor.x += direction.x;

        // add the reference to the actor's new position
        actorMap[actor.y + '_' + actor.x] = actor;

        // if space is a healing space and actor is the player, heal player and remove heal space
        if (map[actor.y][actor.x] == '+' && actor == player) {
            map[actor.y][actor.x] = '.';
            // max of 9 hp
            if (player.hp <= 9) {
                player.hp++;
            }
        }
    }
    return true;
}

function aiAct(actor) {
    var directions = [ {x:-1, y:0}, { x:1, y:0}, {x:0, y:-1}, {x:0, y:1} ]
    var dx = player.x - actor.x;
    var dy = player.y - actor.y;

    // if player is far away (>6 spaces), walk randomly
    if (Math.abs(dx) + Math.abs(dy) > 6) {
        // try to walk in random directions until you succeed once
        while (!moveTo(actor, directions[randomInt(directions.length)])) {};
    } else {
        //otherwise walk towards player
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) {
                // left
                moveTo(actor, directions[0]);
            } else {
                // right
                moveTo(actor, directions[1]);
            }
        } else {
            if (dy < 0) {
                // up
                moveTo(actor, directions[2]);
            } else {
                //down
                moveTo(actor, directions[3]);
            }
        }

        if (player.hp < 1) {
            // game over message
            var gameOver = game.add.text(
                game.world.centerX, game.world.centerY, 
                "Game Over\nCtrl+r to restart", { fill:"#e22", align:"center"}
            );
            gameOver.anchor.setTo(0.5, 0.5);
        }
    }
}

function levelClear() {
    if (gameLevel == 5) {
        playVictoryMessage();
    } else {
        gameLevel++;
        ACTORS += 2;
        initMap();
        initActors();
        drawActors();
        drawMap();

        var levelTitle = document.getElementById('level');
        levelTitle.innerHTML = "Level " + gameLevel;    
    }
}

function playVictoryMessage() {
    var victory = game.add.text(
        game.world.centerX, game.world.centerY,
        "Victory!\nCtrl+r to restart", {fill: '#2e2', align: "center"}
    );
    victory.anchor.setTo(0.5, 0.5);
}