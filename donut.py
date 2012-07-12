#donut preferences: for easy reading, run the program.

#output doesn't look pretty and this isn't particularly good code, but oh well.

class Person(object):
    
    def __init__(self, name, donuts):
        self.name = name
        self.likes = donuts['Likes']
        self.dislikes = donuts['Dislikes']
    
    def printinfo(self):
        print 'Name: ', self.name
        print 'Likes: ',  self.likes
        print 'Dislikes: ', self.dislikes
        print ''
        
def main():
    preferences = []
    jason = Person('Jason', {'Likes': ['donut','flavored with unicorns and rainbows'], 'Dislikes': []})
    preferences.append(jason)
    esther = Person('Esther', {'Likes': ['chocolate', 'glazed'], 'Dislikes': []})
    preferences.append(esther)
    ronnie = Person('Ronnie', {'Likes': ['donuts'], 'Dislikes': []})
    preferences.append(ronnie)
    priyanka = Person('Priyanka', {'Likes': ['plain donut with strawberry frosting and sprinkles'], 'Dislikes': []})
    preferences.append(priyanka)
    david = Person('David', {'Likes': ['donuts'], 'Dislikes': []})
    preferences.append(david)
    tanya = Person('Tanya', {'Likes': [], 'Dislikes': []})
    preferences.append(tanya)
    
    for p in preferences:
        p.printinfo()
    
if __name__ == '__main__':
    main()

        
