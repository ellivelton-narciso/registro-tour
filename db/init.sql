CREATE TABLE config (
    id INT(11) NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(255) DEFAULT NULL,
    titulo2 VARCHAR(255) DEFAULT NULL,
    gen INT(11) DEFAULT NULL,
    sprites VARCHAR(255) DEFAULT NULL,
    qtdLimitado INT(11) DEFAULT NULL,
    qtdLimitadoLendario INT(11) DEFAULT NULL,
    listaLimitado LONGTEXT DEFAULT '[]',
    listaLimitadoLendario LONGTEXT DEFAULT '[]',
    listaBanido LONGTEXT DEFAULT '[]',
    hook VARCHAR(255) DEFAULT NULL,
    enviarDiscord TINYINT(1) DEFAULT 0,
    qtdEscolha INT(11) DEFAULT NULL,
    encerrado TINYINT(1) DEFAULT 0,
    prizes TINYINT(1) DEFAULT 0,
    monotype TINYINT(1) DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE prizes (
    id INT(11) NOT NULL AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    codigo VARCHAR(255) NOT NULL,
    pokemon_list LONGTEXT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY nome (nome),
    UNIQUE KEY codigo (codigo)
);

CREATE TABLE trainers (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    pokemon_list LONGTEXT NOT NULL,
    codigo VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY name (name),
    UNIQUE KEY email (email),
    UNIQUE KEY codigo (codigo)
);

CREATE TABLE usuarios (
    id INT(11) NOT NULL AUTO_INCREMENT,
    user VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY user (user)
);