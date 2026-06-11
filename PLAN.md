# Star Wars Unlimited Deck Tools
Website version of the sort deck by set and the trilogy validator python scripts in ~/github/swu-tools

I envision the site to have left and right centered panels. The left will toggle 2 forms, one for entering a deck list url to generate a sorted deck list, and the other for entering 3 decks list urls for the deck validator. The right panel should be the output generated after processing.

## Features and content

## Framework
Decide together. Goal is to run as a single page web app on cloudfronts free-ish webhosting. While developing locally we should be able to run the website in a docker container with "docker compose watch". Id prefer the Astro framework.

## Design Look and Feel
Ive collected a couple websites that I think fit the theme of this website. High level thoughts and ideas here. Design decisions will go in DESIGN.md

- https://www.starwarsnewsnet.com/
I like the font and color themes used, very Star Wars.

- https://starwarsunlimited.com/
Main card game website, the layout here is probably what we will use on our page, along with similar art assets, like section borders, header, and backgrounds

- https://starwars.com
The main star wars website. We should look at fonts and the space background image used on the main page.

- https://swudb.com/deck/nFflVPWtxK
Deck list example. This is a premier legal deck with nice info at the top and clear and easy to read card information in the list. Mousing over a card shows a preview of the card. Ill include a couple screenshot to show the features